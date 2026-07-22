"use client";

import { useEffect, useState } from "react";
import {
  FilterState,
  NumberFilter,
  NumberOperator,
  numberFilterFields,
} from "@/lib/table-utils";

/** 双号推荐筛选面板组件 props */
type DimensionFiltersStep2Props = {
  /** 当前已生效的筛选状态 */
  filters: FilterState;
  /** 当前已生效的第二个推荐号 */
  tuijianNum2: number | null;
  /** 筛选提交回调（回车或点击提交时触发） */
  onChange: (filters: FilterState, tuijianNum2: number | null) => void;
};

/** 字段中文名映射 */
const fieldLabels: Record<keyof FilterState, string> = {
  dimension: "维度",
  max_step: "最大步长",
  current_distance: "当前距离",
  tuijian_num: "推荐号",
};

/** 操作符中文映射 */
const operatorLabels: Record<NumberOperator, string> = {
  ">": "大于",
  ">=": "大于等于",
  "=": "等于",
  "<=": "小于等于",
  "<": "小于",
  range: "区间",
};

/** 数字筛选字段 key（双号页面中推荐号单独处理） */
type NumberFilterField = "max_step" | "current_distance";

/**
 * 创建空的默认筛选状态，用于清除。
 *
 * @returns 默认 FilterState
 */
function createEmptyFilter(): FilterState {
  return {
    dimension: "",
    max_step: { operator: ">", value: null, min: null, max: null },
    current_distance: { operator: ">", value: null, min: null, max: null },
    tuijian_num: { operator: "=", value: null, min: null, max: null },
  };
}

/**
 * 更新数字筛选配置中的指定字段。
 *
 * @param prev - 当前完整筛选状态
 * @param field - 要更新的数字字段
 * @param patch - 部分 NumberFilter 更新
 * @returns 新的 FilterState
 */
function updateNumberFilter(
  prev: FilterState,
  field: NumberFilterField,
  patch: Partial<NumberFilter>
): FilterState {
  return {
    ...prev,
    [field]: {
      ...prev[field],
      ...patch,
    },
  };
}

/**
 * 解析输入字符串为数字或 null。
 *
 * @param rawValue - 输入字符串
 * @returns 有效数字或 null
 */
function parseNumberInput(rawValue: string): number | null {
  if (rawValue === "") return null;
  const value = Number(rawValue);
  return isNaN(value) ? null : value;
}

/**
 * 维度双号推荐筛选面板。
 * 提供维度名称模糊搜索、数字列（大于/等于/小于/区间）筛选，
 * 以及推荐号双号码输入筛选（输入一个时包含即命中，输入两个时需同时包含）。
 */
export default function DimensionFiltersStep2({
  filters,
  tuijianNum2,
  onChange,
}: DimensionFiltersStep2Props) {
  /** 本地草稿状态，用户编辑时仅更新此状态 */
  const [draft, setDraft] = useState<FilterState>(filters);
  /** 本地第二个推荐号草稿 */
  const [draftTuijianNum2, setDraftTuijianNum2] = useState<number | null>(
    tuijianNum2
  );

  /**
   * 当父组件传入的 filters / tuijianNum2 变化时（例如点击清除后），
   * 同步更新本地草稿，保证双方一致。
   */
  useEffect(() => {
    setDraft(filters);
    setDraftTuijianNum2(tuijianNum2);
  }, [filters, tuijianNum2]);

  /**
   * 将本地草稿提交给父组件，真正触发筛选/分页请求。
   */
  function handleSubmit() {
    onChange(draft, draftTuijianNum2);
  }

  /**
   * 处理维度文本输入变化。
   */
  function handleDimensionChange(value: string) {
    setDraft((prev) => ({ ...prev, dimension: value }));
  }

  /**
   * 处理操作符变化。
   */
  function handleOperatorChange(
    field: NumberFilterField,
    operator: NumberOperator
  ) {
    setDraft((prev) =>
      updateNumberFilter(prev, field, {
        operator,
        value: null,
        min: null,
        max: null,
      })
    );
  }

  /**
   * 处理单值数字输入变化。
   */
  function handleValueChange(field: NumberFilterField, rawValue: string) {
    const value = parseNumberInput(rawValue);
    setDraft((prev) =>
      updateNumberFilter(prev, field, {
        value,
      })
    );
  }

  /**
   * 处理区间最小值/最大值变化。
   */
  function handleRangeChange(
    field: NumberFilterField,
    boundary: "min" | "max",
    rawValue: string
  ) {
    const value = parseNumberInput(rawValue);
    setDraft((prev) =>
      updateNumberFilter(prev, field, {
        [boundary]: value,
      })
    );
  }

  /**
   * 处理推荐号输入变化。
   */
  function handleTuijianNumChange(
    slot: "first" | "second",
    rawValue: string
  ) {
    const value = parseNumberInput(rawValue);
    if (slot === "first") {
      setDraft((prev) => ({
        ...prev,
        tuijian_num: {
          ...prev.tuijian_num,
          value,
        },
      }));
    } else {
      setDraftTuijianNum2(value);
    }
  }

  /**
   * 在输入框内按回车时提交筛选。
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      handleSubmit();
    }
  }

  /**
   * 清除所有筛选条件并立即提交。
   */
  function handleClear() {
    const empty = createEmptyFilter();
    setDraft(empty);
    setDraftTuijianNum2(null);
    onChange(empty, null);
  }

  const hasActiveFilter =
    filters.dimension.trim() !== "" ||
    numberFilterFields.some(
      (field) =>
        filters[field].value !== null ||
        filters[field].min !== null ||
        filters[field].max !== null
    ) ||
    tuijianNum2 !== null;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <label
          htmlFor="dimension-filter"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          维度搜索
        </label>
        <input
          id="dimension-filter"
          type="text"
          value={draft.dimension}
          onChange={(e) => handleDimensionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入维度名称，按回车搜索"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-80"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 推荐号双号输入 */}
        <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
          <span className="mb-2 block text-sm font-medium text-gray-700">
            {fieldLabels.tuijian_num}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              placeholder="号码1"
              value={draft.tuijian_num.value ?? ""}
              onChange={(e) => handleTuijianNumChange("first", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="number"
              placeholder="号码2"
              value={draftTuijianNum2 ?? ""}
              onChange={(e) => handleTuijianNumChange("second", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {numberFilterFields
          .filter((field): field is NumberFilterField => field !== "tuijian_num")
          .map((field) => {
            const filter = draft[field];
            return (
              <div
                key={field}
                className="rounded-md border border-gray-100 bg-gray-50 p-3"
              >
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  {fieldLabels[field]}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filter.operator}
                    onChange={(e) =>
                      handleOperatorChange(
                        field,
                        e.target.value as NumberOperator
                      )
                    }
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  >
                    {(Object.keys(operatorLabels) as NumberOperator[]).map(
                      (op) => (
                        <option key={op} value={op}>
                          {operatorLabels[op]}
                        </option>
                      )
                    )}
                  </select>

                  {filter.operator === "range" ? (
                    <>
                      <input
                        type="number"
                        placeholder="最小"
                        value={filter.min ?? ""}
                        onChange={(e) =>
                          handleRangeChange(field, "min", e.target.value)
                        }
                        onKeyDown={handleKeyDown}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        placeholder="最大"
                        value={filter.max ?? ""}
                        onChange={(e) =>
                          handleRangeChange(field, "max", e.target.value)
                        }
                        onKeyDown={handleKeyDown}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </>
                  ) : (
                    <input
                      type="number"
                      placeholder="值"
                      value={filter.value ?? ""}
                      onChange={(e) => handleValueChange(field, e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          提交筛选
        </button>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
}
