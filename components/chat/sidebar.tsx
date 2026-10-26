"use client";

import {
  Database,
  EllipsisVertical,
  HardDrive,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/chat/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types/chat";

export function AppSidebar({
  conversations,
  activeId,
  storageMode,
  model,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  storageMode: "db" | "local";
  model: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => item.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const handleRename = async () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    if (!title) return;
    setBusy(true);
    try {
      await onRename(renaming.id, title);
      setRenaming(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Rename failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await onDelete(deleting.id);
      setDeleting(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <BrandMark className="size-8 text-sm" />
        <div className="min-w-0">
          <span className="block font-serif text-[17px] font-semibold leading-none tracking-tight">
            Lumen
          </span>
          <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
            Thinking partner
          </span>
        </div>
      </div>

      <div className="px-3 pb-2">
        <Button
          variant="outline"
          className="h-9 w-full justify-start gap-2 rounded-xl border-border/80 bg-card/60 px-3 text-[13px] shadow-none transition-all hover:border-brand/35 hover:bg-brand-soft/40"
          onClick={onNewChat}
        >
          <span className="flex size-5 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--brand),var(--brand-warm))] text-white">
            <Plus className="size-3.5" strokeWidth={2.5} />
          </span>
          New conversation
        </Button>
      </div>

      <div className="px-3 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your chats"
            className="h-8 rounded-xl border-transparent bg-muted/60 pl-8 text-xs shadow-none transition-colors focus-visible:border-brand/30 focus-visible:bg-card"
          />
        </div>
      </div>

      <p className="px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/55">
        Recent
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Recent conversations">
        {filtered.length === 0 && !query && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No saved conversations yet. Start a new chat and your history appears here.
          </p>
        )}
        {filtered.length === 0 && query && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No chats match “{query}”.
          </p>
        )}
        <ul className="space-y-0.5">
          {filtered.map((conversation) => {
            const isActive = conversation.id === activeId;
            return (
              <li key={conversation.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 pr-8 text-left text-[13px] transition-all duration-200",
                    isActive
                      ? "bg-card text-foreground shadow-[0_1px_2px_rgba(20,15,40,0.06)] ring-1 ring-border/80"
                      : "text-foreground/75 hover:bg-card/70 hover:text-foreground",
                  )}
                  title={conversation.title}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full transition-colors",
                      isActive ? "bg-brand" : "bg-muted-foreground/25",
                    )}
                  />
                  <span className="truncate">{conversation.title}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Options for ${conversation.title}`}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <EllipsisVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setRenaming({ id: conversation.id, title: conversation.title })}>
                      <Pencil />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => setDeleting(conversation)}>
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      </div>

      {actionError && (
        <p className="mx-3 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {actionError}
          <button type="button" className="ml-2 underline" onClick={() => setActionError(null)}>
            dismiss
          </button>
        </p>
      )}

      <div className="border-t border-border/70 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground/80"
            title={
              storageMode === "db"
                ? "Conversation history is stored in PostgreSQL on the server."
                : "No database configured: history is stored in this browser's localStorage only."
            }
          >
            {storageMode === "db" ? <Database className="size-3" /> : <HardDrive className="size-3" />}
            {storageMode === "db" ? "Synced history" : "On this device"}
          </span>

          <div
            role="group"
            aria-label="Theme"
            className="flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/50 p-0.5"
          >
            <button
              type="button"
              onClick={() => isDark && toggleTheme()}
              aria-label="Use light theme"
              aria-pressed={!isDark}
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-all",
                !isDark
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              <Sun className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => !isDark && toggleTheme()}
              aria-label="Use dark theme"
              aria-pressed={isDark}
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-all",
                isDark
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              <Moon className="size-3" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 truncate text-[10px] text-muted-foreground/60" title={model}>
          Powered by <span className="font-mono">{model}</span>
        </p>
      </div>

      {/* Rename dialog */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        {renaming && (
          <DialogContent>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Choose a clear name for this conversation.</DialogDescription>
            <Input
              autoFocus
              value={renaming.title}
              onChange={(event) => setRenaming({ ...renaming, title: event.target.value })}
              maxLength={200}
              aria-label="Conversation title"
              className="mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenaming(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleRename} disabled={busy || renaming.title.trim().length === 0}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting && (
          <DialogContent>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              “{deleting.title}” will be permanently removed, including all its messages. This cannot be undone.
            </DialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? "Deleting…" : "Delete chat"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
