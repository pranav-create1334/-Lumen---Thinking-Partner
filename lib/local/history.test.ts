import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** LocalStorage stub so tests run in a plain Node environment. */
class FakeStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (key === "throw-on-write") throw new Error("quota exceeded");
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const storage = new FakeStorage();

Object.defineProperty(globalThis, "window", {
  value: { localStorage: storage },
  configurable: true,
});

describe("local-only chat history (browser localStorage)", () => {
  let listLocalConversations: typeof import("@/lib/local/history").listLocalConversations;
  let createLocalConversation: typeof import("@/lib/local/history").createLocalConversation;
  let appendLocalMessages: typeof import("@/lib/local/history").appendLocalMessages;
  let renameLocalConversation: typeof import("@/lib/local/history").renameLocalConversation;
  let deleteLocalConversation: typeof import("@/lib/local/history").deleteLocalConversation;

  beforeEach(async () => {
    vi.resetModules();
    ({ listLocalConversations, createLocalConversation, appendLocalMessages, renameLocalConversation, deleteLocalConversation } =
      await import("@/lib/local/history"));
  });

  afterEach(() => {
    storage.clear();
  });

  it("creates a conversation and stores messages with updatedAt ordering", async () => {
    const conversation = createLocalConversation("First chat");
    const reloaded = appendLocalMessages(conversation.id, [
      { id: "u1", role: "user", content: "Hello there" },
      { id: "a1", role: "assistant", content: "Hi! How can I help?" },
    ]);
    expect(reloaded.updatedAt >= conversation.updatedAt).toBe(true);

    const conversations = listLocalConversations();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].title).toBe("First chat");
  });

  it("sorts by most recently updated", () => {
    const first = createLocalConversation("First");
    createLocalConversation("Second");
    appendLocalMessages(first.id, [{ id: "u2", role: "user", content: "bump first" }]);
    const titles = listLocalConversations().map((item) => item.title);
    expect(titles[0]).toBe("First");
    expect(titles[1]).toBe("Second");
  });

  it("renames only the targeted conversation", () => {
    const first = createLocalConversation("First");
    createLocalConversation("Second");
    renameLocalConversation(first.id, "Renamed");
    const titles = listLocalConversations().map((item) => item.title);
    expect(titles).toContain("Renamed");
    expect(titles).toContain("Second");
    expect(titles.some((title) => title === "First")).toBe(false);
  });

  it("deletes conversation and its messages", () => {
    const conversation = createLocalConversation("Doomed");
    appendLocalMessages(conversation.id, [{ id: "u3", role: "user", content: "x" }]);
    deleteLocalConversation(conversation.id);
    expect(listLocalConversations()).toHaveLength(0);
  });

  it("surfaces storage failures as a friendly error", async () => {
    const { ensureLocalConversation } = await import("@/lib/local/history");
    const setItem = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => createLocalConversation("Will fail")).toThrow(/storage/i);
    setItem.mockRestore();
    expect(ensureLocalConversation(null, "ok").title).toBe("ok");
  });
});
