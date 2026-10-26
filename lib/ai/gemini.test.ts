import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamGeminiResponse } from "@/lib/ai/gemini";

/**
 * The Gemini SDK is mocked here ONLY so automated tests never need a real
 * API key or consume quota. The production chat flow never uses mocks:
 * it always calls @google/genai directly.
 */

interface MockGenaiState {
  behavior: "ok" | "throw-on-call" | null;
  throwStatus: number;
  okChunks: string[];
  calls: Array<{ model: string; contents: unknown[]; config?: Record<string, unknown> }>;
}

const state: MockGenaiState = { behavior: null, throwStatus: 429, okChunks: [], calls: [] };

vi.mock("@google/genai", () => {
  function GoogleGenAI(this: unknown, options: { apiKey?: string }) {
    if (!options.apiKey) throw new TypeError("apiKey is required");
    return {
      models: {
        async generateContentStream(call: {
          model: string;
          contents: unknown[];
          config?: Record<string, unknown>;
        }) {
          state.calls.push(call);
          if (state.behavior === "throw-on-call") {
            throw Object.assign(new Error("provider rejected the request"), {
              status: state.throwStatus,
            });
          }
          const chunks = state.okChunks;
          return (async function* () {
            for (const text of chunks) yield { text };
          })();
        },
      },
    };
  }
  return { GoogleGenAI };
});

beforeEach(() => {
  state.behavior = null;
  state.throwStatus = 429;
  state.okChunks = [];
  state.calls = [];
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("streamGeminiResponse (mocked SDK)", () => {
  it("yields real streamed text and sends a valid Gemini payload", async () => {
    state.okChunks = ["Hello, ", "world!"];

    const chunks: string[] = [];
    for await (const delta of streamGeminiResponse({
      history: [
        { role: "user", content: "Explain inheritance in Java." },
        { role: "assistant", content: "It lets classes reuse behavior." },
        { role: "user", content: "Give me an example." },
      ],
    })) {
      chunks.push(delta);
    }

    expect(chunks).toEqual(["Hello, ", "world!"]);

    const call = state.calls[0];
    expect(call.model).toBe("gemini-3.5-flash"); // documented default
    expect(call.contents).toEqual([
      { role: "user", parts: [{ text: "Explain inheritance in Java." }] },
      { role: "model", parts: [{ text: "It lets classes reuse behavior." }] },
      { role: "user", parts: [{ text: "Give me an example." }] },
    ]);
    const config = call.config as { systemInstruction: string; maxOutputTokens: number };
    expect(config.systemInstruction.length).toBeGreaterThan(40);
    expect(config.maxOutputTokens).toBeGreaterThan(0);
  });

  it("uses GEMINI_MODEL when configured", async () => {
    process.env.GEMINI_MODEL = "gemini-2.0-flash";
    state.okChunks = ["ok"];
    await streamGeminiResponse({ history: [{ role: "user", content: "hi" }] }).next();
    expect(state.calls[0].model).toBe("gemini-2.0-flash");
    delete process.env.GEMINI_MODEL;
  });

  it("reports a missing API key with a configuration message", async () => {
    delete process.env.GEMINI_API_KEY;
    try {
      await streamGeminiResponse({ history: [{ role: "user", content: "hi" }] }).next();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("MISSING_API_KEY");
      expect((error as Error).message).toContain("GEMINI_API_KEY");
    }
  });

  it("maps 404 provider errors to an actionable MODEL_UNAVAILABLE message", async () => {
    state.behavior = "throw-on-call";
    state.throwStatus = 404;
    process.env.GEMINI_MODEL = "retired-model";
    try {
      await streamGeminiResponse({ history: [{ role: "user", content: "hi" }] }).next();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("MODEL_UNAVAILABLE");
      expect((error as Error).message).toContain("GEMINI_MODEL");
    } finally {
      delete process.env.GEMINI_MODEL;
    }
  });

  it("maps 429 provider errors to RATE_LIMIT", async () => {
    state.behavior = "throw-on-call";
    try {
      await streamGeminiResponse({ history: [{ role: "user", content: "hi" }] }).next();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("RATE_LIMIT");
    }
  });

  it("raises EMPTY_RESPONSE when the model returns nothing", async () => {
    state.okChunks = ["", ""];
    try {
      await streamGeminiResponse({ history: [{ role: "user", content: "hi" }] }).next();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("EMPTY_RESPONSE");
    }
  });
});
