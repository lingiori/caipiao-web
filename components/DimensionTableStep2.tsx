import { Kl8DimensionStep2 } from "@/lib/supabase";
import { SortState, SortableKey } from "@/lib/table-utils";

/** DimensionTableStep2 组件的 props 类型 */
export type DimensionTableStep2Props = {
  /** 要展示的维度双号推荐数据数组 */
  rows: Kl8DimensionStep2[];
  /** 当前排序状态 */
  sort?: SortState;
  /** 排序变化回调 */
  onSortChange?: (sort: SortState) => void;
};

/** 表格列定义：将 Kl8DimensionStep2 的字段 key 映射到中文表头与是否可排序 */
const headers: {
  key: keyof Kl8DimensionStep2;
  label: string;
  sortable: boolean;
}[] = [
  { key: "dimension", label: "维度", sortable: true },
  { key: "max_step", label: "最大步长", sortable: true },
  { key: "min_step", label: "最小步长", sortable: false },
  { key: "avg_step", label: "平均步长", sortable: false },
  { key: "current_distance", label: "当前距离", sortable: true },
  { key: "tuijian_num", label: "推荐号", sortable: true },
  { key: "last_updated", label: "更新时间", sortable: false },
];

/** 可排序列的 key 集合，用于运行时校验 */
const sortableKeys: SortableKey[] = [
  "dimension",
  "max_step",
  "current_distance",
  "tuijian_num",
];

/**
 * 将单元格原始值格式化为可展示的字符串。
 *
 * @param key - 当前字段名
 * @param value - 当前字段值
 * @returns 格式化后的字符串；null/undefined/空数组 显示为 "-"，
 *          last_updated 显示为本地时间，tuijian_num 数组显示为 "12, 34"
 */
function formatValue(
  key: keyof Kl8DimensionStep2,
  value: Kl8DimensionStep2[keyof Kl8DimensionStep2]
): string {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value) && value.length === 0) return "-";
  if (key === "last_updated") {
    try {
      return new Date(value as string).toLocaleString("zh-CN");
    } catch {
      return String(value);
    }
  }
  if (key === "tuijian_num" && Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

/**
 * 排序指示器组件。
 * 未排序列显示灰色上下箭头；当前排序列显示蓝色上/下箭头。
 */
function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  if (!active) {
    return <span className="ml-1 text-gray-300">↕</span>;
  }
  return (
    <span className="ml-1 text-blue-600">
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

/**
 * 维度双号推荐数据表格组件。
 * 以响应式表格形式展示 Kl8DimensionStep2 数组，支持表头点击排序。
 *
 * @param rows - 需要展示的维度双号推荐数据
 * @param sort - 当前排序状态
 * @param onSortChange - 排序变化回调
 */
export default function DimensionTableStep2({
  rows,
  sort,
  onSortChange,
}: DimensionTableStep2Props) {
  /**
   * 处理表头点击，切换排序列或排序方向。
   *
   * @param key - 被点击的列 key
   */
  function handleSort(key: keyof Kl8DimensionStep2) {
    if (!sortableKeys.includes(key as SortableKey) || !onSortChange) return;

    if (sort?.key === key) {
      onSortChange({
        key: key as SortableKey,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({
        key: key as SortableKey,
        direction: "asc",
      });
    }
  }

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
                onClick={() => h.sortable && handleSort(h.key)}
                className={`px-4 py-3 text-left font-semibold text-gray-700 ${
                  h.sortable
                    ? "cursor-pointer select-none hover:bg-gray-100"
                    : ""
                }`}
              >
                <span className="flex items-center">
                  {h.label}
                  {h.sortable && (
                    <SortIndicator
                      active={sort?.key === h.key}
                      direction={sort?.direction ?? "asc"}
                    />
                  )}
                </span>
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
