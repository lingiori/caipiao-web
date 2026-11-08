"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ChatSidebar from "@/components/chat/ChatSidebar";
import MessageList, {
  type StreamingState,
} from "@/components/chat/MessageList";
import ChatInput from "@/components/chat/ChatInput";
import type { SSEvent } from "@/lib/chat";
import type { ChatMessageRow, ChatSession } from "@/lib/supabase";

/**
 * AI 数据问答页（DeepSeek 风格布局）。
 * 左侧会话历史，右侧聊天窗口；每个会话独立，
 * 会话内上下文由服务端按 session 累积（取最近若干条入模型）。
 */
export default function ChatPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * 统一处理会话过期：任一 /api/chat* 返回 401 时跳回登录页。
   */
  const handleUnauthorized = useCallback(
    (res: Response) => {
      if (res.status === 401) {
        router.replace("/chat/login");
        return true;
      }
      return false;
    },
    [router]
  );

  /** 拉取会话列表 */
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      if (handleUnauthorized(res)) return;
      const data = (await res.json()) as {
        sessions?: ChatSession[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "加载会话失败");
      setSessions(data.sessions ?? []);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "加载会话失败");
    }
  }, [handleUnauthorized]);

  /** 拉取某会话的历史消息 */
  const loadMessages = useCallback(
    async (sessionId: string) => {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}/messages`);
        if (handleUnauthorized(res)) return;
        const data = (await res.json()) as {
          messages?: ChatMessageRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "加载消息失败");
        setMessages(data.messages ?? []);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "加载消息失败");
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [handleUnauthorized]
  );

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // 卸载时中止未完成的流式请求
  useEffect(() => () => abortRef.current?.abort(), []);

  /** 切换会话（null = 新对话） */
  function handleSelect(id: string | null) {
    if (streaming) return;
    setActiveId(id);
    setErrorMessage(null);
    setMobileOpen(false);
    if (id) {
      loadMessages(id);
    } else {
      setMessages([]);
    }
  }

  /** 重命名会话 */
  async function handleRename(id: string, title: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("重命名失败");
      await refreshSessions();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "重命名失败");
    }
  }

  /** 删除会话；删的是当前会话则回到新对话 */
  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      if (id === activeId) {
        setActiveId(null);
        setMessages([]);
      }
      await refreshSessions();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "删除失败");
    }
  }

  /** 发送消息：POST /api/chat 并消费 SSE 流 */
  async function handleSend(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    setErrorMessage(null);

    // 乐观展示用户消息
    const optimistic: ChatMessageRow = {
      id: `tmp-${Date.now()}`,
      session_id: activeId ?? "",
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setStreaming({ text: "", statusLabel: null });

    const controller = new AbortController();
    abortRef.current = controller;
    let doneSessionId: string | null = null;
    let streamError: string | null = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeId, message: content }),
        signal: controller.signal,
      });

      if (handleUnauthorized(res)) {
        return;
      }
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `请求失败（${res.status}）`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const rawEvent = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const line = rawEvent.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;

          let ev: SSEvent;
          try {
            ev = JSON.parse(line.slice(5).trim()) as SSEvent;
          } catch {
            continue;
          }

          if (ev.type === "text") {
            const delta = ev.delta;
            setStreaming((s) => (s ? { ...s, text: s.text + delta } : s));
          } else if (ev.type === "tool") {
            setStreaming((s) =>
              s
                ? {
                    ...s,
                    statusLabel:
                      ev.status === "start" ? ev.label ?? "正在查询…" : null,
                  }
                : s
            );
          } else if (ev.type === "done") {
            doneSessionId = ev.sessionId;
          } else if (ev.type === "error") {
            streamError = ev.message;
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        streamError = e instanceof Error ? e.message : "网络请求失败";
      }
    }

    setStreaming(null);

    if (streamError) {
      setErrorMessage(streamError);
      return;
    }

    // 成功后以服务端落库数据为准重新拉取
    const targetId = doneSessionId ?? activeId;
    if (targetId) {
      setActiveId(targetId);
      await Promise.all([refreshSessions(), loadMessages(targetId)]);
    } else {
      await refreshSessions();
    }
  }

  /** 退出登录 */
  async function handleLogout() {
    abortRef.current?.abort();
    try {
      await fetch("/api/chat-auth/logout", { method: "POST" });
    } finally {
      router.replace("/chat/login");
    }
  }

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* 移动端遮罩 + 抽屉式会话列表 */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="关闭会话列表"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ChatSidebar
          sessions={sessions}
          activeId={activeId}
          disabled={!!streaming}
          onSelect={handleSelect}
          onCreate={() => handleSelect(null)}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </div>

      {/* 右侧聊天窗口 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button
            type="button"
            aria-label="打开会话列表"
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-sm font-medium text-gray-800">AI 数据问答</h1>
          {activeSession && (
            <span className="truncate text-sm text-gray-400">
              · {activeSession.title}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="ml-auto rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            退出登录
          </button>
        </header>

        {errorMessage && (
          <div className="flex-shrink-0 px-4 pt-3">
            <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          </div>
        )}

        <MessageList
          messages={messages}
          streaming={streaming}
          loading={messagesLoading}
          onExample={(q) => handleSend(q)}
        />

        <ChatInput disabled={!!streaming} onSend={handleSend} />
      </div>
    </div>
  );
}
