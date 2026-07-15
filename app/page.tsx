"use client";

import { useEffect, useState } from "react";
import TrendChart from "@/components/TrendChart";
import { Kl8BingoRow } from "@/lib/supabase";

/** 走势图页面分页选项 */
const pageSizeOptions = [25, 50, 100] as const;

/** API 返回的分页数据结构 */
type BingoApiResponse = {
  rows: Kl8BingoRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * 快乐8基本走势图首页。
 * 全屏展示全部历史开奖数据，按期号倒序排列（最新一期在最上方），支持分页浏览，无滚动条。
 */
export default function HomePage() {
  /** 当前页开奖数据 */
  const [rows, setRows] = useState<Kl8BingoRow[]>([]);
  /** 总开奖条数 */
  const [total, setTotal] = useState(0);
  /** 请求或数据处理过程中产生的错误提示信息 */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** 是否仍在加载数据 */
  const [loading, setLoading] = useState(true);

  /** 每页期数 */
  const [pageSize, setPageSize] =
    useState<typeof pageSizeOptions[number]>(50);
  /** 1-based 当前页码 */
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    /**
     * 根据当前分页状态请求 /api/bingo 数据。
     */
    async function fetchData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetch(
          `/api/bingo?page=${currentPage}&pageSize=${pageSize}`
        );
        const data = (await res.json()) as BingoApiResponse;

        if (!res.ok) {
          throw new Error((data as { error?: string }).error || "请求失败");
        }

        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "读取开奖数据失败，请检查环境变量和表权限。"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * 切换每页期数时重置到第 1 页。
   */
  function handlePageSizeChange(size: typeof pageSizeOptions[number]) {
    setPageSize(size);
    setCurrentPage(1);
  }

  return (
    <div className="flex h-screen flex-col bg-[#fffdf5]">
      {/* 页面标题区 */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-amber-200 bg-[#fff7ed] px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">快乐8基本走势图</h1>
          <p className="text-xs text-gray-500">
            数据来源：kl8_bingo_all · 按期号倒序 · 共 {total} 期
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            每页
            <select
              value={pageSize}
              onChange={(e) =>
                handlePageSizeChange(
                  Number(e.target.value) as typeof pageSizeOptions[number]
                )
              }
              className="rounded-md border border-amber-200 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            期
          </label>
        </div>
      </header>

      {/* 走势图主体：自适应填充剩余空间，无滚动条 */}
      <div className="min-h-0 flex-1 px-4 pb-2 pt-2">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-amber-200 bg-[#fffdf5] text-center text-gray-500">
            加载中…
          </div>
        ) : errorMessage ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        ) : (
          <TrendChart rows={rows} />
        )}
      </div>

      {/* 分页控件 */}
      <footer className="flex flex-shrink-0 items-center justify-between border-t border-amber-200 bg-[#fff7ed] px-4 py-2">
        <span className="text-xs text-gray-600">
          第 {currentPage} / {totalPages} 页 · 共 {total} 期
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-md border border-amber-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                page === currentPage
                  ? "bg-blue-600 text-white"
                  : "border border-amber-200 bg-white text-gray-700 hover:bg-amber-50"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-amber-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </footer>
    </div>
  );
}
