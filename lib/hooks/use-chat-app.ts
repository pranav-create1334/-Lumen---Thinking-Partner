"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractStreamLines } from "@/lib/chat/stream-io";
import { appendLocalMessages, ensureLocalConversation } from "@/lib/local/history";
import { LocalHistoryRepository } from "@/lib/local/local-repository";
import { ServerHistoryRepository } from "@/lib/local/server-repository";
import { newLocalId } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/chat";
import type { ChatMessage, ConversationSummary, ModelInfo, StreamEvent } from "@/types/chat";

export interface SendError {
  message: string;
  /** Text to place back in the composer when the user clicks Retry. */
  retryText: string;
}

interface RuntimeConfig extends ModelInfo {
  missingApiKey: boolean;
}

type AssistantStatus = "ok" | "stopped" | "failed";

function toPayloadMessage(message: ChatMessage): { role: ChatMessage["role"]; content: string } {
  return { role: message.role, content: message.content };
}

export function useChatApp() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<SendError | null>(null);
  const [composerText, setComposerText] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const localRepoRef = useRef(new LocalHistoryRepository());
  const serverRepoRef = useRef(new ServerHistoryRepository());
  /**
   * When a local-mode send starts, this records where its successful
   * assistant message should be persisted (only used in local-only mode).
   */
  const localPersistRef = useRef<{ conversationId: string } | null>(null);

  const getRepository = useCallback(
    () => (config?.storageMode === "db" ? serverRepoRef.current : localRepoRef.current),
    [config],
  );

  const syncUrl = useCallback((id: string | null) => {
    try {
      window.history.replaceState(null, "", id ? `/?c=${encodeURIComponent(id)}` : "/");
    } catch {
      // Non-critical.
    }
  }, []);

  /** Full switch: swaps active conversation and clears all message state. */
  const setActiveStrict = useCallback(
    (id: string | null) => {
      activeIdRef.current = id;
      setActiveId(id);
      setMessages([]);
      setStreamText("");
      syncUrl(id);
    },
    [syncUrl],
  );

  /** Adopting an id created by the server during an active send. */
  const adoptConversationId = useCallback(
    (id: string) => {
      activeIdRef.current = id;
      setActiveId(id);
      syncUrl(id);
    },
    [syncUrl],
  );

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await getRepository().list());
    } catch {
      // Boot-time failures surface via loadError; refreshes stay silent.
    }
  }, [getRepository]);

  /**
   * Commits a completed/stopped/failed assistant turn into the message list.
   * Successful local-mode turns are also persisted (user turn was already).
   */
  const commitAssistant = useCallback((content: string, status: AssistantStatus): void => {
    setStreamText("");
    setSending(false);
    if (!content.trim()) {
      localPersistRef.current = null;
      return;
    }
    const assistantMessage = { id: newLocalId(), role: "assistant" as const, content, status };
    setMessages((previous) => [...previous, assistantMessage]);
    if (status === "ok" && localPersistRef.current) {
      const conversationId = localPersistRef.current.conversationId;
      localPersistRef.current = null;
      try {
        appendLocalMessages(conversationId, [
          { id: assistantMessage.id, role: "assistant", content },
        ]);
      } catch (error) {
        console.error("[local] could not persist assistant message", error);
      }
    }
  }, []);

  /* ── Streaming core shared by send() and regenerate() ─────────────────── */

  const runStream = useCallback(
    async (
      payload: unknown,
      userText: string,
      /** Local-mode optimistic data (null in database mode). */
      localContext: { conversationId: string; userMessage: ChatMessage } | null,
    ): Promise<void> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamText("");
      setSending(true);

      let accumulated = "";
      let metaReceived = false;
      let terminal: "done" | "aborted" | "error" | null = null;
      const decoder = new TextDecoder();
      let streamBuffer = "";

      const revertOptimisticUser = (): void => {
        if (localContext) {
          setMessages((previous) => previous.filter((item) => item.id !== localContext.userMessage.id));
        }
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.includes("ndjson")) {
          let message = "The chat service returned an unexpected response. Please try again.";
          try {
            const data = (await response.json()) as { error?: { message?: string } };
            if (data.error?.message) message = data.error.message;
          } catch {
            // keep default message
          }
          setStreamText("");
          setSending(false);
          if (!metaReceived && localContext) revertOptimisticUser();
          setSendError({ message, retryText: userText });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setStreamText("");
          setSending(false);
          setSendError({
            message: "Streaming is not supported by this browser.",
            retryText: userText,
          });
          return;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamBuffer += decoder.decode(value, { stream: true });
          const extracted = extractStreamLines(streamBuffer);
          streamBuffer = extracted.remainder;

          for (const event of extracted.events as StreamEvent[]) {
            switch (event.type) {
              case "meta": {
                metaReceived = true;
                if (event.conversationId && event.conversationId !== activeIdRef.current) {
                  adoptConversationId(event.conversationId);
                }
                if (event.title && event.conversationId) {
                  const conversationId = event.conversationId;
                  const title = event.title;
                  setConversations((items) =>
                    items.some((item) => item.id === conversationId)
                      ? items
                      : [
                          { id: conversationId, title, updatedAt: new Date().toISOString() },
                          ...items,
                        ],
                  );
                }
                break;
              }
              case "delta": {
                accumulated += event.text;
                setStreamText(accumulated);
                break;
              }
              case "done": {
                terminal = "done";
                commitAssistant(accumulated, "ok");
                break;
              }
              case "aborted": {
                terminal = "aborted";
                commitAssistant(accumulated, "stopped");
                break;
              }
              case "error": {
                terminal = "error";
                commitAssistant(accumulated, "failed");
                if (!metaReceived && localContext) revertOptimisticUser();
                setSendError({ message: event.message, retryText: userText });
                break;
              }
            }
          }
        }

        if (terminal === "done") {
          void refreshConversations();
        } else if (terminal === null) {
          // Connection closed without a terminal event: interrupted stream.
          if (accumulated.trim()) commitAssistant(accumulated, "failed");
          else {
            setStreamText("");
            setSending(false);
          }
          if (!metaReceived && localContext) revertOptimisticUser();
          setSendError({
            message: metaReceived
              ? "The response was interrupted. Click Regenerate on the message to continue."
              : "The connection was interrupted. Please try again.",
            retryText: userText,
          });
        }
      } catch (error) {
        if (controller.signal.aborted || (error as { name?: string })?.name === "AbortError") {
          // Deliberately stopped by the user: keep the partial draft visible.
          commitAssistant(accumulated, "stopped");
          return;
        }
        if (accumulated.trim()) commitAssistant(accumulated, "failed");
        else {
          setStreamText("");
          setSending(false);
        }
        revertOptimisticUser();
        setSendError({
          message: "Could not reach the chat service. Check your connection and try again.",
          retryText: userText,
        });
      } finally {
        abortRef.current = null;
      }
    },
    [adoptConversationId, commitAssistant, refreshConversations],
  );

  /* ── Boot: config, restore ?c=<id>, load conversation list ────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        const raw = (await response.json()) as Partial<RuntimeConfig>;
        if (cancelled) return;
        setConfig({
          storageMode: raw.storageMode === "db" ? "db" : "local",
          model: raw.model ?? "gemini-3.5-flash",
          maxMessageLength: raw.maxMessageLength ?? MAX_MESSAGE_LENGTH,
          missingApiKey: Boolean(raw.missingApiKey),
        });
        const repository = raw.storageMode === "db" ? serverRepoRef.current : localRepoRef.current;

        // Restore the previously open conversation after a refresh.
        const requestedId = new URLSearchParams(window.location.search).get("c");
        if (requestedId) {
          try {
            const data = await repository.get(requestedId);
            if (!cancelled) {
              activeIdRef.current = requestedId;
              setActiveId(requestedId);
              setMessages(data.messages);
            }
          } catch {
            if (!cancelled) syncUrl(null);
          }
        }

        try {
          const list = await repository.list();
          if (!cancelled) setConversations(list);
        } catch (error) {
          if (!cancelled) {
            setLoadError(error instanceof Error ? error.message : "Could not load chat history.");
          }
        }
      } catch {
        if (!cancelled) setLoadError("Could not reach the server. Please refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [syncUrl]);

  /* ── Conversation actions ─────────────────────────────────────────────── */

  const selectConversation = useCallback(
    async (id: string) => {
      if (abortRef.current) abortRef.current.abort();
      setSendError(null);
      setLoadError(null);
      try {
        const data = await getRepository().get(id);
        activeIdRef.current = id;
        setActiveId(id);
        setMessages(data.messages);
        setStreamText("");
        syncUrl(id);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not load that conversation.");
      }
    },
    [getRepository, syncUrl],
  );

  const newChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setSendError(null);
    setActiveStrict(null);
  }, [setActiveStrict]);

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const previous = conversations;
      setConversations((items) =>
        items.map((item) => (item.id === id ? { ...item, title } : item)),
      );
      try {
        await getRepository().rename(id, title);
      } catch (error) {
        setConversations(previous);
        throw error instanceof Error ? error : new Error("Rename failed.");
      }
    },
    [conversations, getRepository],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        if (id === activeIdRef.current && abortRef.current) abortRef.current.abort();
        await getRepository().remove(id);
        if (id === activeIdRef.current) setActiveStrict(null);
        await refreshConversations();
      } catch (error) {
        throw error instanceof Error ? error : new Error("Delete failed.");
      }
    },
    [getRepository, refreshConversations, setActiveStrict],
  );

  /* ── Messaging actions ────────────────────────────────────────────────── */

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending || !config) return;
      if (sendError) setSendError(null);

      const userMessage: ChatMessage = {
        id: newLocalId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const historyBefore = messages;

      if (config.storageMode === "db") {
        // The server persists the user message and loads authoritative context.
        setMessages([...historyBefore, userMessage]);
        await runStream(
          { conversationId: activeIdRef.current ?? undefined, message: trimmed },
          trimmed,
          null,
        );
        return;
      }

      // Local-only mode: browser storage is the only persistence.
      let conversationId: string | null = activeIdRef.current;
      try {
        const conversation = ensureLocalConversation(conversationId, trimmed);
        const isNew = !activeIdRef.current;
        conversationId = conversation.id;
        if (isNew) adoptConversationId(conversation.id);
        appendLocalMessages(conversation.id, [userMessage]);
      } catch (error) {
        setSendError({
          message: error instanceof Error ? error.message : "Could not save the message locally.",
          retryText: trimmed,
        });
        return;
      }
      void refreshConversations();
      setMessages([...historyBefore, userMessage]);
      await runStream(
        { messages: [...historyBefore, userMessage].map(toPayloadMessage) },
        trimmed,
        { conversationId: conversationId!, userMessage },
      );
    },
    [config, messages, refreshConversations, runStream, sendError, sending, adoptConversationId],
  );

  const regenerate = useCallback(async () => {
    if (sending || !config || messages.length === 0) return;

    // Remove trailing assistant turns (completed, stopped, or failed).
    let cut = messages.length;
    while (cut > 0 && messages[cut - 1].role === "assistant") cut -= 1;
    const baseMessages = messages.slice(0, cut);
    if (baseMessages.length === 0 || baseMessages[baseMessages.length - 1].role !== "user") return;

    setMessages(baseMessages);
    setStreamText("");
    setSendError(null);

    const conversationId = activeIdRef.current;
    if (config.storageMode === "db") {
      if (!conversationId) return;
      await runStream({ conversationId, regenerate: true }, "", null);
    } else {
      if (!conversationId) return;
      await runStream({ messages: baseMessages.map(toPayloadMessage) }, "", null);
    }
  }, [config, messages, runStream, sending]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearSendError = useCallback(() => setSendError(null), []);
  const clearLoadError = useCallback(() => setLoadError(null), []);

  /** Retry: puts the failed text back into the composer for resending. */
  const retryFromError = useCallback(() => {
    if (!sendError) return;
    setComposerText(sendError.retryText);
    setSendError(null);
  }, [sendError]);

  return {
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
    actions: {
      selectConversation,
      newChat,
      renameConversation,
      deleteConversation,
      send,
      regenerate,
      stop,
      clearSendError,
      clearLoadError,
      retryFromError,
    },
  };
}

export type ChatAppStore = ReturnType<typeof useChatApp>;
