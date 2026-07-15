import { NextResponse } from "next/server";
import { getAllDimensionSteps } from "@/lib/supabase";

/** 将该 API 路由标记为边缘运行时，以便部署到 Cloudflare Pages 等边缘平台 */
export const runtime = "edge";

/**
 * 处理 GET 请求，返回 kl8_dimension_step 表中的全部维度步长数据。
 *
 * @returns NextResponse 包含数据数组或错误信息的 JSON 响应
 * - 成功：HTTP 200，JSON 形如 { rows: Kl8DimensionStep[] }
 * - 失败：HTTP 500，JSON 形如 { error: string }
 */
export async function GET() {
  try {
    const rows = await getAllDimensionSteps();
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
