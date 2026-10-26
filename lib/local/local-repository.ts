import { AppError } from "@/lib/api/errors";
import {
  deleteLocalConversation,
  getLocalConversation,
  listLocalConversations,
  renameLocalConversation,
} from "@/lib/local/history";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

/**
 * Local-only mode repository (no DATABASE_URL configured).
 * Same surface as ServerHistoryRepository but persists through
 * lib/local/history.ts into browser localStorage.
 */
export class LocalHistoryRepository {
  async list(): Promise<ConversationSummary[]> {
    return listLocalConversations();
  }

  async get(id: string): Promise<{ conversation: ConversationSummary; messages: ChatMessage[] }> {
    const found = getLocalConversation(id);
    if (!found) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    }
    return found;
  }

  async rename(id: string, title: string): Promise<void> {
    renameLocalConversation(id, title);
  }

  async remove(id: string): Promise<void> {
    deleteLocalConversation(id);
  }
}
