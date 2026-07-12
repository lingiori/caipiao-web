import { Kl8DimensionStep } from "@/lib/supabase";

export type DimensionTableProps = {
  rows: Kl8DimensionStep[];
};

const headers: { key: keyof Kl8DimensionStep; label: string }[] = [
  { key: "dimension", label: "维度" },
  { key: "max_step", label: "最大步长" },
  { key: "min_step", label: "最小步长" },
  { key: "avg_step", label: "平均步长" },
  { key: "current_distance", label: "当前距离" },
  { key: "tuijian_num", label: "推荐号" },
  { key: "last_updated", label: "更新时间" },
];

function formatValue(
  key: keyof Kl8DimensionStep,
  value: Kl8DimensionStep[keyof Kl8DimensionStep]
): string {
  if (value === null || value === undefined) return "-";
  if (key === "last_updated") {
    try {
      return new Date(value as string).toLocaleString("zh-CN");
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function DimensionTable({ rows }: DimensionTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        暂无数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h.key}
                scope="col"
                className="px-4 py-3 text-left font-semibold text-gray-700"
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={row.dimension} className="hover:bg-gray-50">
              {headers.map((h) => (
                <td
                  key={`${row.dimension}-${h.key}`}
                  className="whitespace-nowrap px-4 py-3 text-gray-900"
                >
                  {formatValue(h.key, row[h.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
