import type { StreamEvent } from "@/types/chat";

export interface ExtractedLines {
  events: StreamEvent[];
  remainder: string;
}

/**
 * Parses NDJSON stream chunks incrementally. One JSON event per line.
 * Incomplete trailing lines are kept as the remainder until more data arrives.
 * Malformed lines are skipped (never crash the UI on transport noise).
 * @internal exported for unit tests
 */
export function extractStreamLines(buffer: string): ExtractedLines {
  const lines = buffer.split("\n");
  const remainder = (lines.pop() ?? "") as string;
  const events: StreamEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      events.push(JSON.parse(trimmed) as StreamEvent);
    } catch {
      console.error("[stream] malformed event ignored");
    }
  }

  return { events, remainder };
}
