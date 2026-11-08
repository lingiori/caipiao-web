import { NextRequest, NextResponse } from "next/server";
import { deleteChatSession, renameChatSession } from "@/lib/supabase";

/** 边缘运行时，适配 Cloudflare Pages */
export const runtime = "edge";

/** Next 15 中动态路由参数为 Promise，需要 await */
type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH：重命名会话。
 * 请求体：{ title: string }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { title?: string };
    const title = (body.title ?? "").trim().slice(0, 50);
    if (!title) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    await renameChatSession(id, title);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE：删除会话（消息级联删除）。
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteChatSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
