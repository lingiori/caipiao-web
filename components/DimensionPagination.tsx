"use client";

import { pageSizeOptions } from "@/lib/table-utils";

/** 分页控件组件 props */
type DimensionPaginationProps = {
  /** 当前页码（1-based） */
  currentPage: number;
  /** 每页条数 */
  pageSize: 10 | 25 | 50 | 100;
  /** 符合筛选条件的总条数 */
  total: number;
  /** 每页条数变化回调 */
  onPageSizeChange: (pageSize: 10 | 25 | 50 | 100) => void;
  /** 页码变化回调 */
  onPageChange: (page: number) => void;
};

/**
 * 根据当前页、总页数生成要展示的页码数组（含省略号占位）。
 *
 * @param current - 当前页码
 * @param total - 总页数
 * @returns 页码或省略号字符串数组
 */
function getPageNumbers(
  current: number,
  total: number
): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: Array<number | "..."> = [1];

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  pages.push(total);
  return pages;
}

/**
 * 维度信息分页控件。
 * 包含每页条数选择、信息展示、上一页/下一页与页码按钮。
 */
export default function DimensionPagination({
  currentPage,
  pageSize,
  total,
  onPageSizeChange,
  onPageChange,
}: DimensionPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row">
      <div className="text-sm text-gray-600">
        第 <span className="font-medium text-gray-900">{start}</span> -<span className="font-medium text-gray-900">{end}</span> 条，共{" "}
        <span className="font-medium text-gray-900">{total}</span> 条
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          每页
          <select
            value={pageSize}
            onChange={(e) =>
              onPageSizeChange(Number(e.target.value) as 10 | 25 | 50 | 100)
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          条
        </label>

        <nav aria-label="分页" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>

          {getPageNumbers(currentPage, totalPages).map((page, index) =>
            page === "..." ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 py-1.5 text-sm text-gray-400"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  page === currentPage
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
        </nav>
      </div>
    </div>
  );
}
