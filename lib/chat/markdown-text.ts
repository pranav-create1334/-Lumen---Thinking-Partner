/**
 * Converts raw Markdown source into human-friendly plain text for the
 * "Copy response" action. Rendered content is preferred over raw source,
 * so we strip common Markdown syntax while keeping code fences intact.
 * @internal exported for unit tests
 */
export function markdownToPlainText(source: string): string {
  let text = source;

  // Protect fenced code blocks from later stripping.
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    codeBlocks.push(String(code).replace(/\r\n/g, "\n").replace(/\n+$/, ""));
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });

  text = text
    // Bold / italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2")
    // Inline code
    .replace(/`([^`\n]+)`/g, "$1")
    // Headings
    .replace(/^#{1,6}\s+/gm, "")
    // Images → alt text, links → text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    // Unordered list markers
    .replace(/^(\s*)[-*+]\s+/gm, "$1• ")
    // Blockquotes
    .replace(/^>\s?/gm, "")
    // Horizontal rules
    .replace(/^\s*([-*_]\s*){3,}$/gm, "")
    // Strikethrough
    .replace(/~~([^~]+)~~/g, "$1");

  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_m, index) => codeBlocks[Number(index)] ?? "");

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
