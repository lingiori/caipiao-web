import { Kl8DimensionStep } from "@/lib/supabase";

/** DimensionTable 组件的 props 类型 */
export type DimensionTableProps = {
  /** 要展示的维度步长数据数组 */
  rows: Kl8DimensionStep[];
};

/**
 * 表格列定义：将 Kl8DimensionStep 的字段 key 映射到中文表头。
 * 数组顺序决定页面上的列显示顺序。
 */
const headers: { key: keyof Kl8DimensionStep; label: string }[] = [
  { key: "dimension", label: "维度" },
  { key: "max_step", label: "最大步长" },
  { key: "min_step", label: "最小步长" },
  { key: "avg_step", label: "平均步长" },
  { key: "current_distance", label: "当前距离" },
  { key: "tuijian_num", label: "推荐号" },
  { key: "last_updated", label: "更新时间" },
];

/**
 * 将单元格原始值格式化为可展示的字符串。
 *
 * @param key - 当前字段名
 * @param value - 当前字段值
 * @returns 格式化后的字符串；null/undefined 显示为 "-"，last_updated 显示为本地时间
 */
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

/**
 * 维度步长数据表格组件。
 * 以响应式表格形式展示 Kl8DimensionStep 数组，并对空数据、日期字段做友好处理。
 *
 * @param rows - 需要展示的维度步长数据
 */
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
