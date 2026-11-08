"use client";

import type { ChatSession } from "@/lib/supabase";

type ChatSidebarProps = {
  /** 会话列表（按最近更新倒序） */
  sessions: ChatSession[];
  /** 当前选中会话 id；null 表示新对话 */
  activeId: string | null;
  /** 流式期间禁止切换/删除会话 */
  disabled: boolean;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

/**
 * 聊天页左侧会话列表（DeepSeek 风格，沿用全局侧边栏的深色配色）。
 * 桌面端固定宽度 w-72；移动端由页面控制外层抽屉显隐。
 */
export default function ChatSidebar({
  sessions,
  activeId,
  disabled,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ChatSidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-shrink-0 flex-col bg-gray-900 text-gray-300">
      <div className="flex h-14 flex-shrink-0 items-center border-b border-gray-800 px-4">
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          + 新建对话
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-2">
        {sessions.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-gray-500">
            暂无历史对话
          </p>
        )}
        {sessions.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={`group flex items-center border-l-4 pr-2 text-sm ${
                active
                  ? "border-blue-500 bg-gray-800 text-white"
                  : "border-transparent hover:bg-gray-800 hover:text-white"
              }`}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s.id)}
                className="min-w-0 flex-1 truncate px-4 py-2.5 text-left disabled:opacity-50"
                title={s.title}
              >
                {s.title || "新对话"}
              </button>
              <span className="hidden flex-shrink-0 gap-1 group-hover:flex">
                <button
                  type="button"
                  aria-label="重命名"
                  title="重命名"
                  disabled={disabled}
                  onClick={() => {
                    const title = window.prompt("重命名会话", s.title);
                    if (title && title.trim()) onRename(s.id, title.trim());
                  }}
                  className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-50"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  aria-label="删除"
                  title="删除"
                  disabled={disabled}
                  onClick={() => {
                    if (window.confirm(`确定删除会话「${s.title}」？`))
                      onDelete(s.id);
                  }}
                  className="rounded p-1 text-gray-400 hover:text-red-400 disabled:opacity-50"
                >
                  🗑️
                </button>
              </span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
