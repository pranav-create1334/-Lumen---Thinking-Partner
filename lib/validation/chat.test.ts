import { describe, expect, it } from "vitest";
import {
  chatRequestSchema,
  firstZodIssueMessage,
  renameConversationSchema,
} from "@/lib/validation/chat";

describe("chatRequestSchema (database mode)", () => {
  it("accepts a message without a conversationId (new conversation)", () => {
    const parsed = chatRequestSchema.parse({ message: "Hello there" });
    expect(parsed.message).toBe("Hello there");
    expect(parsed.conversationId).toBeUndefined();
  });

  it("accepts a message with a conversationId (continuation)", () => {
    const parsed = chatRequestSchema.parse({
      conversationId: "5ea6b16d-44bc-4c56-9377-a1a04e74a1cd",
      message: "Explain that code line by line.",
    });
    expect(parsed.conversationId).toBe("5ea6b16d-44bc-4c56-9377-a1a04e74a1cd");
  });

  it("rejects invalid conversation ids", () => {
    const result = chatRequestSchema.safeParse({
      conversationId: "not-a-uuid",
      message: "hi",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty and oversized messages", () => {
    expect(chatRequestSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "x".repeat(6001) }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "x".repeat(6000) }).success).toBe(true);
  });

  it("does not allow message + regenerate together", () => {
    const result = chatRequestSchema.safeParse({
      conversationId: "5ea6b16d-44bc-4c56-9377-a1a04e74a1cd",
      message: "again",
      regenerate: true,
    });
    expect(result.success).toBe(false);
  });

  it("regenerate requires conversationId", () => {
    expect(chatRequestSchema.safeParse({ regenerate: true }).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        conversationId: "5ea6b16d-44bc-4c56-9377-a1a04e74a1cd",
        regenerate: true,
      }).success,
    ).toBe(true);
  });

  it("rejects totally empty bodies", () => {
    const result = chatRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodIssueMessage(result.error)).toMatch(/message.*required|conversationId or messages/);
    }
  });

  it("rejects unknown fields", () => {
    expect(
      chatRequestSchema.safeParse({ message: "hi", apiKey: "leak" }).success,
    ).toBe(false);
  });
});

describe("chatRequestSchema (local-only mode)", () => {
  const userTurn = { role: "user" as const, content: "New question" };
  const assistantTurn = { role: "assistant" as const, content: "Answer" };

  it("accepts a local history ending with the user message", () => {
    const result = chatRequestSchema.safeParse({
      messages: [userTurn, assistantTurn, userTurn],
    });
    expect(result.success).toBe(true);
  });

  it("requires the last message to be the new user turn", () => {
    expect(
      chatRequestSchema.safeParse({ messages: [userTurn, assistantTurn] }).success,
    ).toBe(false);
  });

  it("rejects invalid roles", () => {
    expect(
      chatRequestSchema.safeParse({
        messages: [{ role: "system", content: "hack" }, userTurn],
      }).success,
    ).toBe(false);
  });

  it("cannot combine messages with conversationId", () => {
    expect(
      chatRequestSchema.safeParse({
        conversationId: "5ea6b16d-44bc-4c56-9377-a1a04e74a1cd",
        messages: [userTurn],
      }).success,
    ).toBe(false);
  });
});

describe("renameConversationSchema", () => {
  it("trims and validates titles", () => {
    expect(renameConversationSchema.parse({ title: "  My chat  " }).title).toBe("My chat");
    expect(renameConversationSchema.safeParse({ title: "" }).success).toBe(false);
    expect(renameConversationSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
  });
});
