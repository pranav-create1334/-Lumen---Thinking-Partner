"use client";

import { Check, Copy } from "lucide-react";
import { memo, useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/chat/code-block";
import { cn, copyToClipboard } from "@/lib/utils";

function nodeText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map((child) => nodeText(child as ReactNode)).join("");
  return "";
}

interface CodeProps {
  className?: string;
  children?: ReactNode;
}

/** Fenced/inline code: fenced blocks render as highlighted, copyable CodeBlocks. */
function MarkdownCode({ className, children }: CodeProps) {
  const text = nodeText(children);
  const language = /language-([\w-]+)/.exec(className ?? "")?.[1];
  if (language || text.includes("\n")) {
    return <CodeBlock code={text.replace(/\n$/, "")} language={language} />;
  }
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
  );
}

interface PreProps {
  children?: ReactNode;
}

/** `pre` only wraps fenced code, which already renders its own box. */
function MarkdownPre({ children }: PreProps) {
  return <>{children}</>;
}

interface TableProps {
  children?: ReactNode;
}

function MarkdownTable({ children }: TableProps) {
  return (
    <div className="my-3 w-fit max-w-full overflow-x-auto rounded-lg border border-border">
      <table>{children}</table>
    </div>
  );
}

interface AnchorProps {
  href?: string;
  children?: ReactNode;
}

/** External links from AI output open securely in a new tab. */
function MarkdownAnchor({ href, children }: AnchorProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );
}

/**
 * Safe markdown renderer: react-markdown never renders raw HTML by default,
 * so AI output cannot inject scripts or styles.
 */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: MarkdownAnchor,
          code: MarkdownCode,
          pre: MarkdownPre,
          table: MarkdownTable,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

/** Copy action for assistant replies (copies readable plain text). */
export function CopyResponseButton({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleClick = async (): Promise<void> => {
    const success = await copyToClipboard(content);
    if (success) setCopied(true);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      aria-label="Copy response"
    >
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
