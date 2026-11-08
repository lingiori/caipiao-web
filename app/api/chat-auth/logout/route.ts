import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/chat-auth";

/** 边缘运行时，适配 Cloudflare Pages */
export const runtime = "edge";

/**
 * POST：退出登录，清除会话 cookie。
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
