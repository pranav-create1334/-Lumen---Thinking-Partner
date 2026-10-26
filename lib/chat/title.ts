/**
 * Derives a conversation title from the first user message.
 * Shared between server (database mode) and client (local mode).
 */
export function titleFromMessage(firstUserMessage: string): string {
  const firstLine = firstUserMessage.trim().split(/\r?\n/, 1)[0] ?? "";
  const title = firstLine.length > 0 ? firstLine : firstUserMessage.trim();
  if (title.length <= 48) return title || "New Chat";
  return title.slice(0, 48).trimEnd() + "…";
}
