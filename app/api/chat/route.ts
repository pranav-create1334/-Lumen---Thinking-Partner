import { AppError, handleRouteError, jsonError, logServerError } from "@/lib/api/errors";
import { AiError, streamGeminiResponse } from "@/lib/ai/gemini";
import { MAX_CONTEXT_MESSAGES, getStorageMode } from "@/lib/config";
import {
  createConversation,
  deleteMessage,
  getConversation,
  getMessages,
  saveMessage,
  touchConversation,
} from "@/lib/db/queries";
import { titleFromMessage } from "@/lib/chat/title";
import { clientKeyFromRequest, checkRateLimit } from "@/lib/rate-limit";
import { chatRequestSchema, firstZodIssueMessage } from "@/lib/validation/chat";
import type { ChatMessage, StreamEvent } from "@/types/chat";
import type { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatInput = z.infer<typeof chatRequestSchema>;

/**
 * POST /api/chat — create or continue a conversation and stream a real
 * Gemini response back to the client as NDJSON (one JSON event per line).
 *
 * Events: `meta`, `delta` (repeatable), then `done` | `aborted` | `error`.
 *
 * Persistence rules (database mode):
 *  - The user message is saved when the send operation begins.
 *  - The assistant message is saved only after the stream completes
 *    successfully; partial or failed responses are never persisted.
 *  - A retried send whose payload is identical to the last saved user
 *    message is not duplicated.
 *  - Regeneration strips the trailing assistant message before continuing.
 */
export async function POST(request: Request) {
  try {
    if (!checkRateLimit(clientKeyFromRequest(request))) {
      return jsonError(
        429,
        "RATE_LIMITED",
        "Too many messages sent. Please wait a few minutes before trying again.",
      );
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", firstZodIssueMessage(parsed.error));
    }
    const input = parsed.data;

    const isDb = getStorageMode() === "db";
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        /** Enqueue safely: the client may have already disconnected. */
        const send = (event: StreamEvent): void => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            closed = true;
          }
        };
        const finish = (): void => {
          try {
            controller.close();
          } catch {
            // already closed
          }
          closed = true;
        };

        try {
          let history: { role: ChatMessage["role"]; content: string }[];
          if (isDb) {
            history = await prepareDatabaseHistory(input, send);
          } else {
            // Local-only mode: the client sends its validated turn list.
            // The server does not persist anything in this mode.
            history = input.messages ?? [];
          }

          const trimmed = trimHistoryForContext(history, MAX_CONTEXT_MESSAGES);

          let generated = "";
          let aborted = false;
          try {
            for await (const delta of streamGeminiResponse({
              history: trimmed.map((message) => ({ role: message.role, content: message.content })),
              signal: request.signal,
            })) {
              generated += delta;
              send({ type: "delta", text: delta });
            }
          } catch (error) {
            aborted =
              (error as { name?: string })?.name === "AbortError" ||
              request.signal.aborted ||
              ((error instanceof AppError && error.code === "ABORTED") ?? false);
            if (!aborted) throw error;
          }

          if (aborted) {
            // Deliberately stopped by the user: never persist partial output.
            send({ type: "aborted" });
            if (isDb && input.conversationId) await touchConversation(input.conversationId);
            finish();
            return;
          }

          if (!generated.trim()) {
            // Defensive: an empty response likewise never becomes an answer.
            throw new AppError(
              502,
              "EMPTY_RESPONSE",
              "The AI returned an empty response (it may have been blocked). Try rephrasing your question.",
            );
          }

          if (isDb && input.conversationId) {
            const assistantMessage = await saveMessage(input.conversationId, "assistant", generated);
            await touchConversation(input.conversationId);
            send({
              type: "done",
              conversationId: input.conversationId,
              assistantMessageId: assistantMessage.id,
            });
          } else {
            send({ type: "done" });
          }
          finish();
        } catch (streamError) {
          const mapped = describeError(streamError);
          send({ type: "error", code: mapped.code, message: mapped.message });
          logServerError("POST /api/chat", streamError);
          finish();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    // Unreachable in practice; a last-resort safety net.
    return handleRouteError("POST /api/chat (pre-stream)", error);
  }
}

/** Simple context-window policy: keep the most recent N messages. */
function trimHistoryForContext(
  history: { role: ChatMessage["role"]; content: string }[],
  maxMessages: number,
): { role: ChatMessage["role"]; content: string }[] {
  if (history.length <= maxMessages) return history;
  return history.slice(history.length - maxMessages);
}

/** Loads persisted history after saving/regenerating the user turn. */
async function prepareDatabaseHistory(
  input: ChatInput,
  send: (event: StreamEvent) => void,
): Promise<ChatMessage[]> {
  let conversationId = input.conversationId;
  let createdTitle: string | undefined;

  if (conversationId) {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    }
  } else if (typeof input.message === "string") {
    createdTitle = titleFromMessage(input.message);
    const conversation = await createConversation(createdTitle);
    conversationId = conversation.id;
  } else {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "A message is required to start a conversation.",
    );
  }

  const messages = await getMessages(conversationId);

  if (input.regenerate) {
    let current = messages;
    while (current.length > 0 && current[current.length - 1].role === "assistant") {
      await deleteMessage(current[current.length - 1].id);
      current = current.slice(0, -1);
    }
    if (current.length === 0 || current[current.length - 1].role !== "user") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Cannot regenerate: there is no user message to regenerate from.",
      );
    }
    send({ type: "meta", conversationId });
    return current;
  }

  const newMessage = input.message ?? "";
  const last = messages[messages.length - 1];
  const isExactRetry =
    last !== undefined && last.role === "user" && last.content === newMessage;

  if (!isExactRetry) {
    await saveMessage(conversationId, "user", newMessage);
    send({ type: "meta", conversationId, title: createdTitle });
    return [...messages, { id: "", role: "user" as const, content: newMessage, createdAt: undefined }];
  }

  // Retry of a failed send: the user message is already persisted.
  send({ type: "meta", conversationId });
  return messages;
}

function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof AiError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "ABORTED", message: "Generation was cancelled." };
  }
  return { code: "INTERNAL_ERROR", message: "Something went wrong while generating the response." };
}
