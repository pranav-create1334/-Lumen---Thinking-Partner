import { describe, expect, it } from "vitest";
import { buildGeminiContents, mapSdkError } from "@/lib/ai/gemini";
import { titleFromMessage } from "@/lib/chat/title";
import { markdownToPlainText } from "@/lib/chat/markdown-text";
import { extractStreamLines } from "@/lib/chat/stream-io";
import type { StreamEvent } from "@/types/chat";

describe("buildGeminiContents (conversation context mapping)", () => {
  it("maps assistant turns to the 'model' role required by Gemini", () => {
    const contents = buildGeminiContents([
      { role: "user", content: "Explain inheritance in Java." },
      { role: "assistant", content: "Inheritance is…" },
      { role: "user", content: "Give me an example." },
    ]);
    expect(contents).toEqual([
      { role: "user", parts: [{ text: "Explain inheritance in Java." }] },
      { role: "model", parts: [{ text: "Inheritance is…" }] },
      { role: "user", parts: [{ text: "Give me an example." }] },
    ]);
  });

  it("merges consecutive same-role turns validly", () => {
    const contents = buildGeminiContents([
      { role: "user", content: "First try" },
      { role: "user", content: "Second try (retry)" },
    ]);
    expect(contents).toHaveLength(1);
    expect(contents[0].role).toBe("user");
    expect(contents[0].parts).toHaveLength(2);
    expect(contents[0].parts[1].text).toBe("Second try (retry)");
  });
});

describe("mapSdkError (provider errors → user-safe messages)", () => {
  it("maps rate limits", () => {
    const error = mapSdkError({ status: 429, message: "quota exceeded" });
    expect(error.code).toBe("RATE_LIMIT");
    expect(error.status).toBe(429);
    expect(error.message.toLowerCase()).toContain("rate limit");
  });

  it("maps invalid API keys without exposing details", () => {
    const error = mapSdkError({ status: 400, message: "API key not valid. Pass `?key=supersecret`" });
    expect(error.code).toBe("INVALID_API_KEY");
    expect(error.message).not.toContain("supersecret");
  });

  it("marks cancellations as ABORTED", () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const error = mapSdkError(abortError);
    expect(error.code).toBe("ABORTED");
  });
});

describe("titleFromMessage", () => {
  it("uses the first line and truncates long titles", () => {
    expect(titleFromMessage("Explain OOP in Java")).toBe("Explain OOP in Java");
    const truncated = titleFromMessage("This is a very long first line that keeps going beyond the limit");
    expect(truncated).toBe("This is a very long first line that keeps going…");
    const multi = titleFromMessage("first line\nsecond line");
    expect(multi).toBe("first line");
  });
});

describe("markdownToPlainText (copy action)", () => {
  it("strips common markdown but preserves code fences", () => {
    const source = [
      "## Heading",
      "",
      "Some **bold** and *italic* with `code`.",
      "",
      "```python",
      "def hello():",
      "    return 'world'",
      "```",
    ].join("\n");
    const text = markdownToPlainText(source);
    expect(text).toContain("Heading");
    expect(text).toContain("Some bold and italic with code.");
    expect(text).toContain("def hello():");
    expect(text).not.toContain("```");
    expect(text).not.toContain("**bold**");
  });
});

describe("extractStreamLines (NDJSON client parser)", () => {
  it("parses complete events and keeps partial remainder lines", () => {
    const meta: StreamEvent = { type: "meta", conversationId: "abc" };
    const events = [
      meta,
      { type: "delta", text: "Hel" } satisfies StreamEvent,
      { type: "delta", text: "lo" } satisfies StreamEvent,
      { type: "done" } satisfies StreamEvent,
    ];
    const buffer = events
      .slice(0, 2)
      .map((event) => JSON.stringify(event))
      .join("\n");
    const partial = buffer + "\n" + JSON.stringify(events[2]).slice(0, 8); // torn write

    const extracted = extractStreamLines(partial);
    expect(extracted.events).toEqual([meta, { type: "delta", text: "Hel" }]);
    expect(extracted.remainder).toBe(`{"type":`);

    const next = extractStreamLines(extracted.remainder + JSON.stringify(events[2]).slice(8) + "\n");
    expect(next.events).toEqual([{ type: "delta", text: "lo" }]);
  });

  it("never throws on malformed lines", () => {
    const extracted = extractStreamLines("{not json\n{\"type\":\"done\"}\n");
    expect(extracted.events).toEqual([{ type: "done" }]);
  });
});
