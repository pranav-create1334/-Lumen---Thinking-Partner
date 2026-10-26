"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Multiline composer: Enter sends, Shift+Enter adds a newline, auto-grows up
 * to a comfortable height, shows a character counter near the limit, and
 * swaps Send for Stop while a response is streaming.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  sending,
  streamingWithoutText,
  maxLength,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  streamingWithoutText: boolean;
  maxLength: number;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearLimit = value.length >= maxLength * 0.9;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const canSend = !disabled && !sending && value.trim().length > 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="w-full px-3 pb-3 pt-2 sm:px-6 sm:pb-4 md:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) onSend();
          }}
          className={cn(
            "group relative flex w-full items-end gap-2 rounded-[24px] border border-border/90 bg-card/85 p-2 pl-3 shadow-[0_10px_40px_-26px_rgba(20,15,40,0.45)] backdrop-blur-md transition-all duration-300",
            "focus-within:border-brand/40 focus-within:shadow-[0_16px_50px_-28px_var(--brand)] focus-within:ring-[3px] focus-within:ring-brand/10",
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
          />
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxLength}
            disabled={disabled}
            placeholder="Ask anything, or think out loud…"
            aria-label="Message to send to the assistant"
            rows={1}
            className="max-h-56 min-h-[44px] flex-1 border-0 bg-transparent px-1.5 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
          />
          <div className="flex flex-col items-center gap-1 pb-0.5">
            {sending ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground transition-all hover:scale-105 hover:bg-accent active:scale-95"
              >
                <Square className="size-3.5" fill="currentColor" stroke="none" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  "flex size-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-warm))] text-white shadow-[0_8px_22px_-10px_var(--brand)] transition-all duration-300",
                  canSend
                    ? "scale-100 opacity-100 hover:scale-105 hover:brightness-105 active:scale-95"
                    : "scale-95 cursor-not-allowed opacity-35",
                  streamingWithoutText && "animate-pulse",
                )}
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            )}
            <span
              className={cn(
                "h-3 text-[10px] font-medium tabular-nums",
                nearLimit ? "text-amber-600 dark:text-amber-400" : "text-transparent",
              )}
            >
              {nearLimit ? `${maxLength - value.length} left` : "0"}
            </span>
          </div>
        </form>

        <div className="mt-2 flex items-center justify-between gap-3 px-1.5 text-[10.5px] text-muted-foreground/70">
          <span className="hidden items-center gap-1.5 sm:flex">
            <kbd className="rounded border border-border/80 bg-card px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">Enter</kbd>
            to send
            <span className="text-border">·</span>
            <kbd className="rounded border border-border/80 bg-card px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">Shift + Enter</kbd>
            for a new line
          </span>
          <span className="sm:hidden">Tap to send</span>
          <span className="truncate text-right">AI can make mistakes — verify important details.</span>
        </div>
      </div>
    </div>
  );
}
