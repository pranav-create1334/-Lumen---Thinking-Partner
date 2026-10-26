import type { StreamEvent } from "@/types/chat";

/**
 * Minimal structured error used by API routes. `message` is always safe to
 * show to the user; internals are logged server-side instead of exposed.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function logServerError(scope: string, error: unknown): void {
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // Deliberately logs only the error class and message, never secrets or
  // conversation content.
  console.error(`[${scope}] ${detail}`);
}

/** Non-streaming JSON error response helper. */
export function jsonError(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Maps any thrown error into a structured, user-safe JSON response.
 * Unknown errors become a generic 500 without internal details.
 */
export function handleRouteError(scope: string, error: unknown): Response {
  if (error instanceof AppError) {
    return jsonError(error.status, error.code, error.message);
  }
  logServerError(scope, error);
  return jsonError(500, "INTERNAL_ERROR", "Something went wrong on the server. Please try again.");
}

/** Same mapping, but delivered as a chat-stream error event. */
export function streamErrorEvent(code: string, message: string): StreamEvent {
  return { type: "error", code, message };
}

/**
 * Ensures conversations across route params are well-formed UUIDs.
 * Throws 400/404-style AppErrors otherwise.
 */
export function requireUuid(id: string | undefined): string {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof id !== "string" || !pattern.test(id)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid conversation id format.");
  }
  return id;
}
