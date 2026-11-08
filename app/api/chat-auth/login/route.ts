import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyCredentials,
} from "@/lib/chat-auth";

/** 边缘运行时，适配 Cloudflare Pages */
export const runtime = "edge";

/**
 * POST：账号密码登录（账号来自 ai.config.json 的 auth.users）。
 * 请求体：{ user: string, password: string }
 * 成功：Set-Cookie 会话 + { ok: true }；失败：401。
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      user?: string;
      password?: string;
    };
    const user = String(body.user ?? "").trim();
    const password = String(body.password ?? "");

    if (!user || !password) {
      return NextResponse.json(
        { error: "请输入用户名和密码" },
        { status: 400 }
      );
    }

    const ok = await verifyCredentials(user, password);
    if (!ok) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(user);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
