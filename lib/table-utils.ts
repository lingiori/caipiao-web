/**
 * 维度表格可排序列。
 */
export type SortableKey =
  | "dimension"
  | "max_step"
  | "current_distance"
  | "tuijian_num";

/**
 * 排序方向。
 */
export type SortDirection = "asc" | "desc";

/**
 * 数字筛选操作符。
 */
export type NumberOperator = ">" | ">=" | "=" | "<=" | "<" | "range";

/**
 * 单个数字列的筛选配置。
 */
export type NumberFilter = {
  /** 比较操作符 */
  operator: NumberOperator;
  /** 单值操作符使用的目标值 */
  value: number | null;
  /** 区间操作符使用的下限 */
  min: number | null;
  /** 区间操作符使用的上限 */
  max: number | null;
};

/**
 * 完整筛选状态。
 */
export type FilterState = {
  /** 维度名称模糊搜索关键词 */
  dimension: string;
  /** 最大步长筛选 */
  max_step: NumberFilter;
  /** 当前距离筛选 */
  current_distance: NumberFilter;
  /** 推荐号筛选 */
  tuijian_num: NumberFilter;
};

/**
 * 排序状态。
 */
export type SortState = {
  /** 当前排序列 */
  key: SortableKey;
  /** 当前排序方向 */
  direction: SortDirection;
};

/**
 * 分页状态。
 */
export type PaginationState = {
  /** 每页条数 */
  pageSize: 10 | 25 | 50 | 100;
  /** 1-based 当前页码 */
  currentPage: number;
};

/** 数字筛选的字段列表 */
export const numberFilterFields = [
  "max_step",
  "current_distance",
  "tuijian_num",
] as const;

/** 每页条数可选项 */
export const pageSizeOptions = [10, 25, 50, 100] as const;

/**
 * 创建默认的数字筛选配置。
 *
 * @returns 默认 NumberFilter
 */
function createDefaultNumberFilter(): NumberFilter {
  return {
    operator: ">",
    value: null,
    min: null,
    max: null,
  };
}

/**
 * 创建默认的完整筛选状态。
 *
 * @returns 默认 FilterState
 */
export function createDefaultFilter(): FilterState {
  return {
    dimension: "",
    max_step: createDefaultNumberFilter(),
    current_distance: createDefaultNumberFilter(),
    tuijian_num: createDefaultNumberFilter(),
  };
}

/** 默认排序状态：按维度升序 */
export const DEFAULT_SORT: SortState = {
  key: "dimension",
  direction: "asc",
};

/** 默认分页状态：每页 25 条，第 1 页 */
export const DEFAULT_PAGINATION: PaginationState = {
  pageSize: 25,
  currentPage: 1,
};

/**
 * 判断 NumberFilter 是否设置了有效条件。
 *
 * @param filter - 数字筛选配置
 * @returns 是否存在有效筛选条件
 */
function isNumberFilterActive(filter: NumberFilter): boolean {
  if (filter.operator === "range") {
    return filter.min !== null || filter.max !== null;
  }
  return filter.value !== null;
}

/**
 * 将筛选状态序列化为 URL 查询字符串片段。
 *
 * @param filters - 当前筛选状态
 * @returns URLSearchParams 可消费的 Record
 */
export function filtersToSearchParams(
  filters: FilterState
): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.dimension.trim()) {
    params.dimension = filters.dimension.trim();
  }

  for (const field of numberFilterFields) {
    const filter = filters[field];
    if (!isNumberFilterActive(filter)) continue;

    params[`${field}_operator`] = filter.operator;

    if (filter.operator === "range") {
      if (filter.min !== null) params[`${field}_min`] = String(filter.min);
      if (filter.max !== null) params[`${field}_max`] = String(filter.max);
    } else if (filter.value !== null) {
      params[`${field}_value`] = String(filter.value);
    }
  }

  return params;
}

/**
 * 将分页、排序、筛选状态合并为 URL 查询字符串。
 *
 * @param pagination - 分页状态
 * @param sort - 排序状态
 * @param filters - 筛选状态
 * @returns URL 查询字符串（不含前导 ?）
 */
export function buildDimensionQueryString(
  pagination: PaginationState,
  sort: SortState,
  filters: FilterState
): string {
  const params = new URLSearchParams();

  params.set("page", String(pagination.currentPage));
  params.set("pageSize", String(pagination.pageSize));
  params.set("sortField", sort.key);
  params.set("sortDirection", sort.direction);

  const filterParams = filtersToSearchParams(filters);
  for (const [key, value] of Object.entries(filterParams)) {
    params.set(key, value);
  }

  return params.toString();
}

/**
 * 从 URLSearchParams 解析分页状态，无效值回退到默认值。
 *
 * @param searchParams - URL 查询参数
 * @returns 解析后的 PaginationState
 */
export function parsePagination(searchParams: URLSearchParams): PaginationState {
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const pageSize = pageSizeOptions.includes(pageSizeRaw as 10 | 25 | 50 | 100)
    ? (pageSizeRaw as 10 | 25 | 50 | 100)
    : DEFAULT_PAGINATION.pageSize;

  const currentPageRaw = Number(searchParams.get("page"));
  const currentPage =
    Number.isFinite(currentPageRaw) && currentPageRaw > 0
      ? currentPageRaw
      : DEFAULT_PAGINATION.currentPage;

  return { pageSize, currentPage };
}

/**
 * 从 URLSearchParams 解析排序状态，无效值回退到默认值。
 *
 * @param searchParams - URL 查询参数
 * @returns 解析后的 SortState
 */
export function parseSort(searchParams: URLSearchParams): SortState {
  const key = searchParams.get("sortField") as SortableKey | null;
  const validKeys: SortableKey[] = [
    "dimension",
    "max_step",
    "current_distance",
    "tuijian_num",
  ];

  const direction = searchParams.get("sortDirection") as SortDirection | null;
  const validDirection: SortDirection[] = ["asc", "desc"];

  return {
    key: key && validKeys.includes(key) ? key : DEFAULT_SORT.key,
    direction:
      direction && validDirection.includes(direction)
        ? direction
        : DEFAULT_SORT.direction,
  };
}

/**
 * 从 URLSearchParams 解析筛选状态，无效值回退到默认值。
 *
 * @param searchParams - URL 查询参数
 * @returns 解析后的 FilterState
 */
export function parseFilters(searchParams: URLSearchParams): FilterState {
  const filters = createDefaultFilter();

  const dimension = searchParams.get("dimension");
  if (dimension !== null) {
    filters.dimension = dimension;
  }

  const validOperators: NumberOperator[] = [">", ">=", "=", "<=", "<", "range"];

  for (const field of numberFilterFields) {
    const operator = searchParams.get(`${field}_operator`) as NumberOperator | null;
    if (!operator || !validOperators.includes(operator)) continue;

    const filter = filters[field];
    filter.operator = operator;

    if (operator === "range") {
      const minRaw = searchParams.get(`${field}_min`);
      const maxRaw = searchParams.get(`${field}_max`);
      filter.min = minRaw !== null && !isNaN(Number(minRaw)) ? Number(minRaw) : null;
      filter.max = maxRaw !== null && !isNaN(Number(maxRaw)) ? Number(maxRaw) : null;
    } else {
      const valueRaw = searchParams.get(`${field}_value`);
      filter.value =
        valueRaw !== null && !isNaN(Number(valueRaw)) ? Number(valueRaw) : null;
    }
  }

  return filters;
}

/**
 * 从 URLSearchParams 解析完整的查询状态。
 *
 * @param searchParams - URL 查询参数
 * @returns 分页、排序、筛选状态
 */
export function parseDimensionQueryParams(searchParams: URLSearchParams): {
  pagination: PaginationState;
  sort: SortState;
  filters: FilterState;
} {
  return {
    pagination: parsePagination(searchParams),
    sort: parseSort(searchParams),
    filters: parseFilters(searchParams),
  };
}
