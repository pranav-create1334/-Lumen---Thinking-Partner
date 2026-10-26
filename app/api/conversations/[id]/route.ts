import { handleRouteError, jsonError, requireUuid } from "@/lib/api/errors";
import { getStorageMode } from "@/lib/config";
import {
  deleteConversation,
  getConversation,
  getMessages,
  renameConversation,
} from "@/lib/db/queries";
import { renameConversationSchema } from "@/lib/validation/chat";

/**
 * GET /api/conversations/[id] — fetch one conversation with all messages.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (getStorageMode() !== "db") {
      return jsonError(
        501,
        "LOCAL_ONLY_MODE",
        "Server-side history is disabled (no DATABASE_URL). Conversations are stored locally in your browser.",
      );
    }
    const raw = await params;
    const id = requireUuid(raw?.id);
    const conversation = await getConversation(id);
    if (!conversation) {
      return jsonError(404, "CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    }
    const messages = await getMessages(id);
    return Response.json(
      { conversation, messages },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError("GET /api/conversations/[id]", error);
  }
}

/**
 * PATCH /api/conversations/[id] — rename a conversation.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (getStorageMode() !== "db") {
      return jsonError(
        501,
        "LOCAL_ONLY_MODE",
        "Server-side history is disabled (no DATABASE_URL). Conversations are stored locally in your browser.",
      );
    }
    const raw = await params;
    const id = requireUuid(raw?.id);

    const body = await request.json().catch(() => null);
    const parsed = renameConversationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", "Title must be between 1 and 200 characters.");
    }

    const conversation = await renameConversation(id, parsed.data.title);
    return Response.json(
      { conversation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError("PATCH /api/conversations/[id]", error);
  }
}

/**
 * DELETE /api/conversations/[id] — delete conversation + messages (cascade).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (getStorageMode() !== "db") {
      return jsonError(
        501,
        "LOCAL_ONLY_MODE",
        "Server-side history is disabled (no DATABASE_URL). Conversations are stored locally in your browser.",
      );
    }
    const raw = await params;
    const id = requireUuid(raw?.id);
    await deleteConversation(id);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError("DELETE /api/conversations/[id]", error);
  }
}
