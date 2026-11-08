"use client";

import { useRef, useState } from "react";

type ChatInputProps = {
  /** 流式期间禁用输入 */
  disabled: boolean;
  onSend: (text: string) => void;
};

/**
 * 底部输入框：自动增高（最多 6 行），Enter 发送、Shift+Enter 换行。
 */
export default function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) el.style.height = "auto";
    });
  }

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={
            disabled ? "正在生成回答…" : "输入你的问题，Enter 发送，Shift+Enter 换行"
          }
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-40 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
