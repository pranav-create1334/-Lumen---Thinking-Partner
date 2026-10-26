import { AppError } from "@/lib/api/errors";
import { titleFromMessage } from "@/lib/chat/title";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

/**
 * Local-only persistence (used ONLY when DATABASE_URL is not configured).
 *
 * History is stored in this browser's localStorage on this device:
 * it is not saved to PostgreSQL and not shared across devices/browsers.
 */

const STORAGE_KEY = "ai-chat.history.v1";
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 300;

/**
 * Monotonic ISO timestamp factory (same-millisecond writes still sort
 * in mutation order).
 */
let lastStamp = 0;
function stampNow(): string {
  let now = Date.now();
  if (now <= lastStamp) now = lastStamp + 1;
  lastStamp = now;
  return new Date(now).toISOString();
}

interface LocalHistory {
  version: 1;
  conversations: ConversationSummary[];
  messages: Record<string, ChatMessage[]>;
}

function emptyHistory(): LocalHistory {
  return { version: 1, conversations: [], messages: {} };
}

function read(): LocalHistory {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw) as LocalHistory;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.conversations)) return emptyHistory();
    return {
      version: 1,
      conversations: parsed.conversations,
      messages: parsed.messages ?? {},
    };
  } catch (error) {
    console.error("[local-store] could not read history", error);
    return emptyHistory();
  }
}

function write(history: LocalHistory): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    throw new AppError(
      500,
      "LOCAL_STORAGE_UNAVAILABLE",
      "Browser storage is unavailable or full, so chat history could not be saved locally.",
    );
  }
}

function sortByUpdatedAt(items: ConversationSummary[]): ConversationSummary[] {
  return [...items].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function listLocalConversations(): ConversationSummary[] {
  return sortByUpdatedAt(read().conversations);
}

export function getLocalConversation(id: string): { conversation: ConversationSummary; messages: ChatMessage[] } | null {
  const history = read();
  const conversation = history.conversations.find((item) => item.id === id);
  if (!conversation) return null;
  return { conversation, messages: history.messages[id] ?? [] };
}

export function getLocalMessages(id: string): ChatMessage[] {
  return read().messages[id] ?? [];
}

export function createLocalConversation(title: string): ConversationSummary {
  const history = read();
  const now = stampNow();
  const conversation: ConversationSummary = { id: newId(), title: title || "New Chat", createdAt: now, updatedAt: now };
  history.conversations = [conversation, ...history.conversations].slice(0, MAX_CONVERSATIONS);
  history.messages[conversation.id] = [];
  write(history);
  return conversation;
}

export function appendLocalMessages(conversationId: string, newMessages: ChatMessage[]): ConversationSummary {
  const history = read();
  const index = history.conversations.findIndex((item) => item.id === conversationId);
  if (index === -1) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "That conversation could not be found.");
  }
  const conversation = history.conversations[index];
  conversation.updatedAt = stampNow();

  const combined = [...(history.messages[conversationId] ?? []), ...newMessages];
  history.messages[conversationId] =
    combined.length > MAX_MESSAGES_PER_CONVERSATION
      ? combined.slice(combined.length - MAX_MESSAGES_PER_CONVERSATION)
      : combined;

  history.conversations[index] = conversation;
  history.conversations = sortByUpdatedAt(history.conversations);
  write(history);
  return conversation;
}

export function renameLocalConversation(id: string, title: string): ConversationSummary {
  const history = read();
  const index = history.conversations.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "That conversation could not be found.");
  }
  const conversation = { ...history.conversations[index], title: title || titleFromMessage(title) };
  history.conversations[index] = conversation;
  write(history);
  return conversation;
}

export function deleteLocalConversation(id: string): void {
  const history = read();
  const nextConversations = history.conversations.filter((item) => item.id !== id);
  if (nextConversations.length === history.conversations.length) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "That conversation could not be found.");
  }
  const messages = { ...history.messages };
  delete messages[id];
  write({ version: 1, conversations: nextConversations, messages });
}

/** Ensures a conversation exists for an incoming first message. */
export function ensureLocalConversation(existingId: string | null, firstUserMessage: string): ConversationSummary {
  if (existingId) {
    const found = getLocalConversation(existingId);
    if (found) return found.conversation;
  }
  return createLocalConversation(titleFromMessage(firstUserMessage));
}
