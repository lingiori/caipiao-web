import DimensionTable from "@/components/DimensionTable";
import { getAllDimensionSteps } from "@/lib/supabase";

import { Kl8DimensionStep } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let rows: Kl8DimensionStep[] = [];
  let errorMessage: string | null = null;

  try {
    rows = await getAllDimensionSteps();
  } catch (error) {
    rows = [];
    errorMessage =
      error instanceof Error
        ? error.message
        : "读取 Supabase 数据失败，请检查环境变量和表权限。";
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            快乐8 维度信息
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            数据来源：kl8_dimension_step
          </p>
        </div>

        {errorMessage ? (
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
