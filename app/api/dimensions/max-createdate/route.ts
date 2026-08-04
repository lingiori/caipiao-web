import { NextResponse } from "next/server";
import { getMaxCreatedate } from "@/lib/supabase";

/** 将该 API 路由标记为边缘运行时，以便部署到 Cloudflare Pages 等边缘平台 */
export const runtime = "edge";

/**
 * 处理 GET 请求，返回 kl8_dimension_step 表中 createdate 的最大日期。
 * 供维度信息页面设置日期筛选的默认值。
 *
 * @returns NextResponse 包含最大日期或错误信息
 * - 成功：HTTP 200，JSON 形如 { maxCreatedate: string | null }
 * - 失败：HTTP 500，JSON 形如 { error: string }
 */
export async function GET() {
  try {
    const maxCreatedate = await getMaxCreatedate();
    return NextResponse.json({ maxCreatedate });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
