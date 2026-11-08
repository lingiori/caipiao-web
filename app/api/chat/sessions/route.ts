import { NextRequest, NextResponse } from "next/server";
import { createChatSession, listChatSessions } from "@/lib/supabase";

/** 边缘运行时，适配 Cloudflare Pages */
export const runtime = "edge";

/**
 * GET：列出全部会话（按最近更新倒序）。
 * 成功：{ sessions: ChatSession[] }
 */
export async function GET() {
  try {
    const sessions = await listChatSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST：手动创建空会话。
 * 请求体：{ title?: string }
 * 成功：{ session: ChatSession }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
    };
    const session = await createChatSession((body.title ?? "").slice(0, 50));
    return NextResponse.json({ session });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
