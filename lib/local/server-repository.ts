import type { ChatMessage, ConversationSummary } from "@/types/chat";

/**
 * Server-mode repository: thin, typed fetch wrappers over the API routes.
 * Used when the config endpoint reports storageMode === "db".
 */

export class ServerHistoryRepository {
  private async parseResponse<T>(response: Response): Promise<T> {
    if (response.ok) return (await response.json()) as T;
    let message = "The chat history service returned an error.";
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  async list(): Promise<ConversationSummary[]> {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    const data = await this.parseResponse<{ conversations: ConversationSummary[] }>(response);
    return data.conversations;
  }

  async get(id: string): Promise<{ conversation: ConversationSummary; messages: ChatMessage[] }> {
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    return this.parseResponse(response);
  }

  async rename(id: string, title: string): Promise<void> {
    const response = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await this.parseResponse(response);
  }

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) await this.parseResponse(response);
  }
}
