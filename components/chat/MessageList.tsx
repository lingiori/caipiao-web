"use client";

import { useEffect, useRef } from "react";
import type { ChatMessageRow } from "@/lib/supabase";
import MarkdownView from "./MarkdownView";

/** 流式进行中的状态 */
export type StreamingState = {
  /** 已收到的 Markdown 文本 */
  text: string;
  /** 当前工具调用状态文案；null 表示无工具在执行 */
  statusLabel: string | null;
};

type MessageListProps = {
  messages: ChatMessageRow[];
  streaming: StreamingState | null;
  /** 历史消息加载中 */
  loading: boolean;
  /** 空态示例问题点击 */
  onExample: (question: string) => void;
};

/** 空态展示的三个示例问题 */
const EXAMPLES = [
  "最近100期最热和最冷的10个号码分别是哪些？",
  "当前有哪些维度满足或接近推荐条件？",
  "最近30期的奇偶比与和值有什么规律？画个图表看看。",
];

/**
 * 聊天消息列表：用户右侧蓝色气泡，assistant 左侧 Markdown 卡片。
 * 流式期间显示工具状态 pill + 实时渲染的 partial Markdown + 闪烁光标。
 * 新内容出现时自动滚动到底部。
 */
export default function MessageList({
  messages,
  streaming,
  loading,
  onExample,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const isEmpty = messages.length === 0 && !streaming && !loading;

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {loading && (
          <div className="py-16 text-center text-sm text-gray-500">
            加载中…
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="text-center">
              <h2 className="text-lg font-medium text-gray-800">
                AI 数据问答
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                用数学和概率的方法分析快乐8数据。试试下面的问题：
              </p>
            </div>
            <div className="flex w-full max-w-lg flex-col gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onExample(q)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[80%]">
              <div className="whitespace-pre-wrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm">
                {m.content}
              </div>
            </div>
          ) : (
            <div
              key={m.id}
              className="w-full rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm"
            >
              <MarkdownView content={m.content} />
            </div>
          )
        )}

        {streaming && (
          <div className="w-full rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
            {streaming.statusLabel && (
              <div className="mb-3">
                <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {streaming.statusLabel}
                </span>
              </div>
            )}
            {streaming.text ? (
              <>
                <MarkdownView content={streaming.text} />
                <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-blue-500 align-text-bottom" />
              </>
            ) : (
              <span className="text-sm text-gray-400">正在思考…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
