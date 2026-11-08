import { NextRequest, NextResponse } from "next/server";
import { listChatMessages } from "@/lib/supabase";

/** 边缘运行时，适配 Cloudflare Pages */
export const runtime = "edge";

/** Next 15 中动态路由参数为 Promise，需要 await */
type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET：列出会话的历史消息（按时间升序，最多 200 条）。
 * 成功：{ messages: ChatMessageRow[] }
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const messages = await listChatMessages(id);
    return NextResponse.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
