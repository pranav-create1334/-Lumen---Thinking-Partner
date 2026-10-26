/**
 * Central runtime configuration. Values are read at request time so that
 * editing `.env.local` only requires a dev-server restart, never a rebuild.
 */

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

/** Server-side only. Never expose this to the client. */
export function geminiApiKey(): string {
  return readEnv("GEMINI_API_KEY");
}

/** Configurable model with a documented, currently supported default. */
export function geminiModel(): string {
  // Verified working with a current AI Studio key. Older IDs such as
  // gemini-2.5-flash are rejected with 404 for new users, so keep this
  // default up to date and allow overriding via GEMINI_MODEL.
  return readEnv("GEMINI_MODEL") || "gemini-3.5-flash";
}

/** Reasonable default output-token limit (overridable via env). */
export function maxOutputTokens(): number {
  return Number(readEnv("GEMINI_MAX_OUTPUT_TOKENS")) || 2048;
}

/** Maximum number of recent messages sent to Gemini as context. */
export const MAX_CONTEXT_MESSAGES = 24;

/**
 * Storage mode:
 *  - "db":    PostgreSQL persistence via Drizzle (requires DATABASE_URL).
 *  - "local": browser localStorage fallback (single-device history only).
 */
export function getStorageMode(): "db" | "local" {
  return readEnv("DATABASE_URL") ? "db" : "local";
}

/** Basic in-memory rate limit: requests per 5-minute window per client IP. */
export const RATE_LIMIT_MAX_REQUESTS = 20;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
