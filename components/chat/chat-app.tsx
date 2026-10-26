"use client";

import { ArrowDown, CircleAlert, Menu, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Composer } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageBubble, ThinkingIndicator } from "@/components/chat/message-bubble";
import { AppSidebar } from "@/components/chat/sidebar";
import { ThemeProvider } from "@/lib/hooks/use-theme";
import { useChatApp } from "@/lib/hooks/use-chat-app";
import { cn } from "@/lib/utils";

function InfoBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="animate-rise mx-auto flex w-full max-w-3xl items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3.5 py-2.5 text-[12.5px] text-destructive shadow-sm backdrop-blur">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <CircleAlert className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-words leading-relaxed">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium underline-offset-2 transition-colors hover:bg-destructive/10 hover:underline"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

function ChatWorkspace() {
  const store = useChatApp();
  const {
    config,
    conversations,
    activeId,
    messages,
    sending,
    streamText,
    loadError,
    sendError,
    composerText,
    setComposerText,
    actions,
  } = store;

  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Auto-scroll: follow the stream only while the reader is near the bottom. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 140;
    nearBottomRef.current = nearBottom;
    setShowJumpButton(!nearBottom);
  };

  useEffect(() => {
    if (nearBottomRef.current) scrollToBottom("smooth");
  }, [messages.length, streamText, sending]);

  useEffect(() => {
    nearBottomRef.current = true;
    setShowJumpButton(false);
    scrollToBottom("auto");
  }, [activeId]);

  // Auto-restore failed composer text so it can be retried without retyping.
  useEffect(() => {
    if (sendError?.retryText && composerText.trim() === "") {
      setComposerText(sendError.retryText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendError]);

  const handleSend = (text: string) => {
    nearBottomRef.current = true;
    setComposerText("");
    void actions.send(text);
  };

  const maxMessageLength = config?.maxMessageLength ?? 6000;
  const storageMode = config?.storageMode ?? "local";
  const activeTitle = conversations.find((item) => item.id === activeId)?.title;
  const showWelcome = messages.length === 0 && !sending;
  const [configBannerDismissed, setConfigBannerDismissed] = useState(false);

  const lastAssistantIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") return index;
    }
    return -1;
  })();

  const sidebarProps = {
    conversations,
    activeId,
    storageMode,
    model: config?.model ?? "gemini-3.5-flash",
    onSelect: (id: string) => {
      setDrawerOpen(false);
      void actions.selectConversation(id);
    },
    onNewChat: () => {
      setDrawerOpen(false);
      actions.newChat();
    },
    onRename: actions.renameConversation,
    onDelete: actions.deleteConversation,
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-[276px] shrink-0 border-r border-border/70 md:flex md:flex-col">
        <AppSidebar {...sidebarProps} />
      </aside>

      {/* Mobile drawer */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          className="left-0 top-0 h-full max-w-[86vw] translate-x-0 translate-y-0 rounded-l-none rounded-r-2xl border-r p-0 shadow-2xl"
          hideClose
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="h-full overflow-y-auto">
            <AppSidebar {...sidebarProps} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Workspace */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-56 bg-[radial-gradient(60%_100%_at_50%_0%,var(--glow-a),transparent_75%)] opacity-40"
        />
        <header className="relative z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/65 px-3 backdrop-blur-md sm:px-5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/55 sm:inline">
              Workspace
            </span>
            <span aria-hidden className="hidden text-muted-foreground/30 sm:inline">
              /
            </span>
            <h2 className="min-w-0 truncate text-[13px] font-medium text-foreground/85">
              {activeTitle ?? "New chat"}
            </h2>
          </div>
          <span
            className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground backdrop-blur lg:inline-flex"
            title={`Gemini model: ${config?.model ?? ""}`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {config?.model ?? "…"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.newChat}
            className="hidden rounded-full border border-transparent text-[12px] text-muted-foreground transition-colors hover:border-border/70 hover:bg-card hover:text-foreground md:inline-flex"
          >
            <Plus className="size-3.5" />
            New chat
          </Button>
        </header>

        <div className="space-y-2 px-3 pt-3 sm:px-6 md:px-8">
          {loadError && <InfoBanner message={loadError} onDismiss={() => actions.clearLoadError()} />}
          {config?.missingApiKey && !configBannerDismissed && (
            <InfoBanner
              message="The Gemini API key is not configured yet. Copy .env.example to .env.local, set GEMINI_API_KEY, then restart the dev server — chat responses require it."
              onDismiss={() => setConfigBannerDismissed(true)}
            />
          )}
        </div>

        {/* Messages */}
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={handleScroll} className={cn("h-full overflow-y-auto", showWelcome && "flex flex-col")}>
            {showWelcome ? (
              <EmptyState onSuggest={handleSend} />
            ) : (
              <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pb-8 pt-7 sm:px-6">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isLastAssistant={index === lastAssistantIndex && !sending}
                    disabled={sending}
                    onRegenerate={() => void actions.regenerate()}
                  />
                ))}
                {sending && streamText.length > 0 && (
                  <MessageBubble
                    message={{ id: "__streaming__", role: "assistant", content: streamText }}
                    isLastAssistant={false}
                    disabled
                    onRegenerate={() => {}}
                  />
                )}
                {sending && streamText.length === 0 && <ThinkingIndicator />}
                <div aria-hidden className="h-2" />
              </div>
            )}
          </div>

          {showJumpButton && !showWelcome && (
            <button
              type="button"
              onClick={() => {
                nearBottomRef.current = true;
                setShowJumpButton(false);
                scrollToBottom("smooth");
              }}
              aria-label="Scroll to latest message"
              className="absolute bottom-4 left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-lg backdrop-blur transition-all hover:-translate-y-0.5 hover:text-brand"
            >
              <ArrowDown className="size-4" />
            </button>
          )}
        </div>

        {/* Streaming/send error with retry */}
        {sendError && (
          <div className="px-3 pb-1 sm:px-6 md:px-8">
            <InfoBanner
              message={sendError.message}
              onDismiss={actions.clearSendError}
            />
            <div className="mx-auto mt-1 max-w-3xl">
              <Button
                variant="outline"
                size="sm"
                onClick={actions.retryFromError}
                className="mt-1 rounded-full px-3.5 text-[11.5px]"
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        <Composer
          value={composerText}
          onChange={setComposerText}
          onSend={() => handleSend(composerText)}
          onStop={actions.stop}
          sending={sending}
          streamingWithoutText={streamText.length === 0}
          maxLength={maxMessageLength}
        />
      </div>
    </div>
  );
}

export function ChatApp() {
  return (
    <ThemeProvider>
      <ChatWorkspace />
    </ThemeProvider>
  );
}
