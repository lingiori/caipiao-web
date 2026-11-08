"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * AI 问答登录页（/chat/login）。
 * 账号密码来自 ai.config.json 的 auth.users，验证通过后签发会话 cookie。
 */
export default function ChatLoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/chat-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "登录失败");
      }
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-gray-900">AI 数据问答</h1>
        <p className="mt-1 text-sm text-gray-500">请输入账号密码访问</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="mt-5 block text-sm text-gray-700">
          用户名
          <input
            type="text"
            value={user}
            autoComplete="username"
            onChange={(e) => setUser(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="mt-4 block text-sm text-gray-700">
          密码
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !user.trim() || !password}
          className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {submitting ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
