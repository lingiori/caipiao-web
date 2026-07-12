"use client";

import { useEffect, useState } from "react";
import DimensionTable from "@/components/DimensionTable";
import { Kl8DimensionStep } from "@/lib/supabase";

export default function HomePage() {
  const [rows, setRows] = useState<Kl8DimensionStep[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dimensions");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "请求失败");
        }
        setRows(data.rows ?? []);
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
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">快乐8 维度信息</h1>
          <p className="mt-1 text-sm text-gray-600">数据来源：kl8_dimension_step</p>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
            加载中…
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        ) : (
          <DimensionTable rows={rows} />
        )}
      </div>
    </div>
  );
}
