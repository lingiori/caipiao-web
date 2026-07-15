import { NextRequest, NextResponse } from "next/server";
import { getDimensionSteps } from "@/lib/supabase";
import { parseDimensionQueryParams } from "@/lib/table-utils";

/** 将该 API 路由标记为边缘运行时，以便部署到 Cloudflare Pages 等边缘平台 */
export const runtime = "edge";

/**
 * 处理 GET 请求，返回 kl8_dimension_step 表中经过筛选、排序、分页后的数据。
 *
 * @param request - Next.js 请求对象，包含 page / pageSize / sortField /
 *                  sortDirection / dimension / *_operator / *_value / *_min / *_max 等查询参数
 * @returns NextResponse 包含当前页数据、总条数、当前页码、每页条数或错误信息
 * - 成功：HTTP 200，JSON 形如 { rows: Kl8DimensionStep[], total: number, page: number, pageSize: number }
 * - 失败：HTTP 500，JSON 形如 { error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { pagination, sort, filters } = parseDimensionQueryParams(
      request.nextUrl.searchParams
    );

    const { rows, total } = await getDimensionSteps({
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      sortField: sort.key,
      sortDirection: sort.direction,
      filters,
    });

    return NextResponse.json({
      rows,
      total,
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
