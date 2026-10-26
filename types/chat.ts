/** Shared types for chat data structures used by both client and server. */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** ISO timestamp, when available. */
  createdAt?: string;
  /**
   * Client-only status annotation. Not persisted server-side.
   * - "stopped": user deliberately stopped generation (partial response).
   * - "failed":  generation failed (partial response kept for context).
   */
  status?: "ok" | "stopped" | "failed";
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt: string;
}

export interface ModelInfo {
  storageMode: "db" | "local";
  model: string;
  maxMessageLength: number;
}

/** Events sent on the /api/chat NDJSON stream. */
export type StreamEvent =
  | { type: "meta"; conversationId: string; title?: string }
  | { type: "delta"; text: string }
  | { type: "done"; conversationId?: string; assistantMessageId?: string }
  | { type: "aborted" }
  | { type: "error"; code: string; message: string };
