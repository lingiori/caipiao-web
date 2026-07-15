import { NextRequest, NextResponse } from "next/server";
import { getBingoData } from "@/lib/supabase";

/** 将该 API 路由标记为边缘运行时，以便部署到 Cloudflare Pages 等边缘平台 */
export const runtime = "edge";

/**
 * 处理 GET 请求，返回 kl8_bingo_all 表中指定页的开奖数据。
 * 数据按期号降序排列，最新一期排在最前。
 *
 * @param request - Next.js 请求对象，包含 page / pageSize 查询参数
 * @returns NextResponse 包含当前页数据、总条数、当前页码、每页条数或错误信息
 * - 成功：HTTP 200，JSON 形如 { rows: Kl8BingoRow[], total: number, page: number, pageSize: number }
 * - 失败：HTTP 500，JSON 形如 { error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const pageRaw = Number(searchParams.get("page"));
    const pageSizeRaw = Number(searchParams.get("pageSize"));

    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize =
      Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 50;

    const { rows, total } = await getBingoData({ page, pageSize });

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
