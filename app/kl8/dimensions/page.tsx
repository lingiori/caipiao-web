"use client";

import { useEffect, useState } from "react";
import DimensionFilters from "@/components/DimensionFilters";
import DimensionPagination from "@/components/DimensionPagination";
import DimensionTable from "@/components/DimensionTable";
import { Kl8DimensionStep } from "@/lib/supabase";
import {
  type FilterState,
  type PaginationState,
  type SortState,
  buildDimensionQueryString,
  createDefaultFilter,
  DEFAULT_PAGINATION,
  DEFAULT_SORT,
} from "@/lib/table-utils";

/** API 返回的分页数据结构 */
type DimensionApiResponse = {
  rows: Kl8DimensionStep[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * 快乐8维度步长页面（客户端组件）。
 * 支持服务端分页、排序与筛选，状态变更时重新请求 /api/dimensions。
 */
export default function Kl8DimensionsPage() {
  /** 当前页数据 */
  const [rows, setRows] = useState<Kl8DimensionStep[]>([]);
  /** 符合筛选条件的总条数 */
  const [total, setTotal] = useState(0);
  /** 请求或数据处理过程中产生的错误提示信息 */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** 是否仍在加载数据 */
  const [loading, setLoading] = useState(true);

  /** 筛选状态 */
  const [filters, setFilters] = useState<FilterState>(createDefaultFilter());
  /** 排序状态 */
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  /** 分页状态 */
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);

  /**
   * 当筛选条件变化时，自动回到第 1 页。
   */
  function handleFiltersChange(nextFilters: FilterState) {
    setFilters(nextFilters);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }

  /**
   * 当排序条件变化时，保持当前页（服务端排序后页码仍有效）。
   */
  function handleSortChange(nextSort: SortState) {
    setSort(nextSort);
  }

  /**
   * 切换页码。
   */
  function handlePageChange(page: number) {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  }

  /**
   * 切换每页条数，并回到第 1 页。
   */
  function handlePageSizeChange(pageSize: 10 | 25 | 50 | 100) {
    setPagination({ pageSize, currentPage: 1 });
  }

  useEffect(() => {
    /**
     * 根据当前分页、排序、筛选状态请求 /api/dimensions 数据。
     */
    async function fetchData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const queryString = buildDimensionQueryString(pagination, sort, filters);
        const res = await fetch(`/api/dimensions?${queryString}`);
        const data = (await res.json()) as DimensionApiResponse;

        if (!res.ok) {
          throw new Error((data as { error?: string }).error || "请求失败");
        }

        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "读取 Supabase 数据失败，请检查环境变量和表权限。"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [pagination, sort, filters]);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">快乐8 维度信息</h1>
          <p className="mt-1 text-sm text-gray-600">数据来源：kl8_dimension_step</p>
        </div>

        <DimensionFilters filters={filters} onChange={handleFiltersChange} />

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
            加载中…
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        ) : (
          <>
            <DimensionTable
              rows={rows}
              sort={sort}
              onSortChange={handleSortChange}
            />
            <DimensionPagination
              currentPage={pagination.currentPage}
              pageSize={pagination.pageSize}
              total={total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
