import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/chat-auth";

/**
 * 路由守卫：/chat 页面与 /api/chat/* 接口需登录。
 * 登录页 /chat/login 本身放行；/api/chat-auth/* 不在此匹配范围内。
 */
export const config = {
  matcher: ["/chat/:path*", "/api/chat/:path*"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/chat/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token) : false;
  if (valid) {
    return NextResponse.next();
  }

  // API 请求返回 401 JSON；页面请求跳转登录页
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "未登录或登录已过期" },
      { status: 401 }
    );
  }
  return NextResponse.redirect(new URL("/chat/login", request.url));
}
