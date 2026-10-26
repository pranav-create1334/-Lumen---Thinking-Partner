"use client";

import { RefreshCcw, TriangleAlert } from "lucide-react";
import { BrandMark } from "@/components/chat/brand-mark";
import { Markdown, CopyResponseButton } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

/**
 * Assistant turn: rendered markdown, copy (plain text) and, for the most
 * recent answer, a regenerate action. Failed/stopped turns show a status note.
 */
function AssistantMessage({
  message,
  isLastAssistant,
  disabled,
  onRegenerate,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  disabled: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="group flex w-full gap-3.5">
      <div className="relative mt-0.5">
        <BrandMark className="size-8 text-[14px]" />
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500"
        />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-semibold tracking-tight text-foreground">Lumen</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
            Assistant
          </span>
        </div>

        <div className="text-[15px] text-foreground/95">
          <Markdown content={message.content} />
        </div>

        {message.status !== "ok" && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-1 text-[11px] text-amber-700 dark:text-amber-300">
            <TriangleAlert className="size-3.5 shrink-0" />
            {message.status === "stopped"
              ? "Response stopped before completing."
              : message.status === "failed"
                ? "Response failed or was interrupted."
                : null}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-1 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <CopyResponseButton content={message.content} />
          {isLastAssistant && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Regenerate response"
            >
              <RefreshCcw className="size-3.5" />
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex w-full justify-end">
      <div className="max-w-[86%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[7px] bg-user-bubble px-4 py-2.5 text-[14.5px] leading-relaxed text-user-bubble-foreground shadow-[0_10px_26px_-20px_rgba(20,15,40,0.8)] sm:max-w-[76%]">
        {message.content}
      </div>
    </div>
  );
}

export function MessageBubble({
  message,
  isLastAssistant,
  disabled,
  onRegenerate,
  className,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  disabled: boolean;
  onRegenerate: () => void;
  className?: string;
}) {
  return (
    <div className={cn("animate-rise w-full", className)}>
      {message.role === "user" ? (
        <UserMessage message={message} />
      ) : (
        <AssistantMessage
          message={message}
          isLastAssistant={isLastAssistant}
          disabled={disabled}
          onRegenerate={onRegenerate}
        />
      )}
    </div>
  );
}

/** Animated "thinking" indicator shown while waiting for first tokens. */
export function ThinkingIndicator() {
  return (
    <div className="animate-rise flex w-full gap-3.5">
      <BrandMark className="mt-0.5 size-8 text-[14px]" />
      <div className="min-w-0 flex-1 pt-1">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-semibold tracking-tight text-foreground">Lumen</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
            Thinking
          </span>
        </div>
        <div className="flex items-center gap-1.5 pt-1" aria-label="Assistant is thinking">
          <span className="thinking-dot size-1.5 rounded-full bg-brand [animation-delay:-0.4s]" />
          <span className="thinking-dot size-1.5 rounded-full bg-brand [animation-delay:-0.2s]" />
          <span className="thinking-dot size-1.5 rounded-full bg-brand" />
          <span className="ml-1.5 text-[11px] text-muted-foreground/60">finding the thread…</span>
        </div>
      </div>
    </div>
  );
}
