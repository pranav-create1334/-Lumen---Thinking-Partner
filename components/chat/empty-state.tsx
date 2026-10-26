"use client";

import { ArrowUpRight, BookOpenText, Bug, FileText, PenLine } from "lucide-react";
import { BrandMark } from "@/components/chat/brand-mark";

export interface Suggestion {
  icon: typeof Bug;
  title: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: BookOpenText,
    title: "Explain a concept",
    prompt: "Explain object-oriented programming in Java with a simple example.",
  },
  {
    icon: Bug,
    title: "Debug with me",
    prompt: "Help me debug my code. My program returns the wrong result from a loop — what common mistakes should I look for?",
  },
  {
    icon: FileText,
    title: "Summarize a topic",
    prompt: "Summarize the main causes of World War I in clear bullet points.",
  },
  {
    icon: PenLine,
    title: "Write something",
    prompt: "Write a short professional email requesting a one-week deadline extension.",
  },
];

/** Centered welcome area shown when the active conversation is empty. */
export function EmptyState({ onSuggest }: { onSuggest: (prompt: string) => void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-5 py-10">
      {/* Ambient brand light */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora-a absolute left-1/2 top-[18%] size-[26rem] -translate-x-[85%] rounded-full bg-[var(--glow-a)] blur-[90px]" />
        <div className="aurora-b absolute left-1/2 top-[42%] size-[22rem] -translate-x-[10%] rounded-full bg-[var(--glow-b)] blur-[100px]" />
      </div>

      <div className="animate-rise flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 py-1 pl-1.5 pr-3 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
          <BrandMark className="size-5 rounded-md text-[11px]" />
          Lumen · your thinking partner
        </div>

        <h1 className="mt-6 max-w-2xl font-serif text-4xl font-medium leading-[1.08] tracking-tight text-foreground sm:text-5xl">
          What&apos;s on your mind?
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Ideas, code, essays, or a problem you can&apos;t quite name yet. Start anywhere — we&apos;ll find the thread together.
        </p>
      </div>

      <div className="animate-rise-slow mt-9 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() => onSuggest(suggestion.prompt)}
            className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/75 p-4 text-left shadow-[0_1px_2px_rgba(20,15,40,0.04)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_14px_34px_-22px_var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
            />
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 text-[13px] font-medium text-foreground">
                <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <suggestion.icon className="size-3.5" />
                </span>
                {suggestion.title}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-medium tabular-nums text-muted-foreground/60">
                {String(index + 1).padStart(2, "0")}
                <ArrowUpRight className="size-3 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-70" />
              </span>
            </span>
            <span className="mt-2.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
              {suggestion.prompt}
            </span>
          </button>
        ))}
      </div>

      <div className="animate-rise-slow mt-8 flex items-center gap-2 text-[11px] text-muted-foreground/70">
        <span className="size-1.5 rounded-full bg-emerald-500/80" />
        Free to use · No sign-up · Powered by Gemini
      </div>
    </div>
  );
}
