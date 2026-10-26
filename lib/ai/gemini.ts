import { GoogleGenAI } from "@google/genai";
import { geminiApiKey, geminiModel, maxOutputTokens } from "@/lib/config";

export class AiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
  }
}

const SYSTEM_INSTRUCTION = `You are a friendly, knowledgeable AI assistant for students and general use.

Guidelines:
- Be accurate and clear. If you are unsure about something, say so honestly instead of claiming certainty. Never fabricate facts, citations, search results, or tool outputs.
- Structure longer answers with short paragraphs, Markdown headings, bullet points, and numbered lists where helpful.
- Use fenced code blocks with a language tag for any code. Include brief explanations around code so it is easy to learn from.
- For math, show the steps of the reasoning.
- For writing tasks (emails, essays, reports), produce polished, well-organized text.
- Be concise by default; expand depth when the question warrants it.
- When a follow-up question refers to earlier conversation, use that context.`;

export interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

const MAX_CHUNK_LENGTH = 20000; // effective no-op for single-message turns

export function maxChunkLength(): number {
  return MAX_CHUNK_LENGTH;
}

/**
 * Maps persisted conversation turns into the `contents` format accepted by
 * the Gemini SDK (roles: "user" | "model") and merges consecutive turns of
 * the same role so multi-part turns form valid conversations.
 * @internal exported for unit tests
 */
export function buildGeminiContents(history: { role: "user" | "assistant"; content: string }[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const message of history) {
    const role = message.role === "assistant" ? "model" : "user";
    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      previous.parts.push({ text: message.content });
    } else {
      contents.push({ role, parts: [{ text: message.content }] });
    }
  }
  return contents;
}

/**
 * Maps an SDK/provider failure into a user-safe AiError.
 * Raw provider errors are never surfaced to clients.
 */
export function mapSdkError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const err = error as
    | { status?: number | string; message?: string; code?: string | number; name?: string }
    | null;

  if (err && (err.name === "AbortError" || err.name === "ResponseAborted" || err.code === "ABORT_ERR")) {
    return new AiError("ABORTED", 499, "Generation was cancelled.");
  }

  const status = typeof err?.status === "number" ? err.status : Number(err?.status);

  if (Number.isFinite(status) && status > 0) {
    if (status === 429) {
      return new AiError(
        "RATE_LIMIT",
        429,
        "The Gemini API rate limit was reached. Please wait a minute and try again.",
      );
    }
    if (status === 404) {
      return new AiError(
        "MODEL_UNAVAILABLE",
        502,
        "The configured Gemini model is no longer available. Set GEMINI_MODEL to a supported model (for example gemini-3.5-flash) in .env.local and restart the server.",
      );
    }
    if (status === 400 || status === 401 || status === 403) {
      return new AiError(
        "INVALID_API_KEY",
        502,
        "Gemini rejected the request. The API key is likely missing or invalid. Check GEMINI_API_KEY in .env.local.",
      );
    }
    if (status >= 500) {
      return new AiError(
        "PROVIDER_UNAVAILABLE",
        502,
        "The Gemini service is temporarily unavailable. Please try again shortly.",
      );
    }
  }

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AiError("NETWORK_ERROR", 502, "Could not reach the Gemini service. Check your network connection.");
  }

  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[gemini] unmapped provider error (${name}): ${message.slice(0, 300)}`);
  return new AiError(
    "PROVIDER_ERROR",
    502,
    "The AI service returned an unexpected error. Please try again.",
  );
}

interface GenerateStreamOptions {
  history: { role: "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}

/**
 * Streams the real Gemini response as text deltas.
 * All networking happens on the server; the API key is never exposed.
 */
export async function* streamGeminiResponse({
  history,
  signal,
}: GenerateStreamOptions): AsyncGenerator<string> {
  const apiKey = geminiApiKey();
  const model = geminiModel();

  if (!apiKey) {
    throw new AiError(
      "MISSING_API_KEY",
      500,
      "The Gemini API key is not configured. Add GEMINI_API_KEY to .env.local and restart the dev server.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  let stream: AsyncGenerator<{ text?: string | null }>;
  try {
    stream = await ai.models.generateContentStream({
      model,
      contents: buildGeminiContents(history),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: maxOutputTokens(),
        // Supported by the official SDK; propagates client cancellations.
        abortSignal: signal,
      },
    });
  } catch (error) {
    throw mapSdkError(error);
  }

  let emitted = false;
  try {
    for await (const chunk of stream) {
      if (signal?.aborted) break;
      if (typeof chunk?.text === "string" && chunk.text.length > 0) {
        emitted = true;
        yield chunk.text;
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      throw new AiError("ABORTED", 499, "Generation was cancelled.");
    }
    throw mapSdkError(error);
  }

  if (!emitted) {
    throw new AiError(
      "EMPTY_RESPONSE",
      502,
      "The AI returned an empty response (it may have been blocked). Try rephrasing your question.",
    );
  }
}
