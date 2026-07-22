import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  type FilterState,
  type SortDirection,
  type SortableKey,
} from "@/lib/table-utils";

/**
 * 快乐8 每期开奖数据表的单行类型定义。
 * 对应 Supabase 数据库中的 kl8_bingo_all 表结构。
 */
export type Kl8BingoRow = {
  /** 自增主键 */
  id: number;
  /** 彩票期号，例如 2026186 */
  issue: number;
  /** 逗号分隔的 20 个开奖号码，形如 "01,07,11,...,80" */
  bingo_num: string;
  /** 记录创建时间（ISO 8601 字符串） */
  created_at: string | null;
};

/**
 * 快乐8 维度步长数据表的单行类型定义。
 * 对应 Supabase 数据库中的 kl8_dimension_step 表结构。
 */
export type Kl8DimensionStep = {
  /** 维度名称（主键），例如某个号码或指标维度 */
  dimension: string;
  /** 该维度在历史数据中出现的最大步长 */
  max_step: number | null;
  /** 该维度在历史数据中出现的最小步长 */
  min_step: number | null;
  /** 该维度在历史数据中的平均步长 */
  avg_step: number | null;
  /** 当前距离上一次出现的间隔 */
  current_distance: number | null;
  /** 基于算法计算出的推荐号码 */
  tuijian_num: number | null;
  /** 数据最近一次更新时间（ISO 8601 字符串） */
  last_updated: string | null;
};

/**
 * 快乐8 维度双号推荐数据表的单行类型定义。
 * 对应 Supabase 数据库中的 kl8_dimension_step2 表结构。
 */
export type Kl8DimensionStep2 = {
  /** 维度名称（主键），例如某个号码或指标维度 */
  dimension: string;
  /** 该维度在历史数据中出现的最大步长 */
  max_step: number | null;
  /** 该维度在历史数据中出现的最小步长 */
  min_step: number | null;
  /** 该维度在历史数据中的平均步长 */
  avg_step: number | null;
  /** 当前距离上一次出现的间隔 */
  current_distance: number | null;
  /** 基于算法计算出的两个推荐号码 */
  tuijian_num: number[] | null;
  /** 命中历史记录 */
  hit_history: string | null;
  /** 数据最近一次更新时间（ISO 8601 字符串） */
  last_updated: string | null;
};

/** Supabase 客户端单例，避免在服务端重复创建连接 */
let client: SupabaseClient | null = null;

/**
 * 获取或创建 Supabase 客户端实例（单例模式）。
 * 优先读取服务端环境变量，回退到 NEXT_PUBLIC_ 前缀的公共变量，
 * 以便在开发、构建及 Cloudflare Pages 等边缘环境中都能正确初始化。
 *
 * @returns 配置好的 SupabaseClient 实例
 * @throws 当缺少 SUPABASE_URL 与 SUPABASE_PUBLISHABLE_KEY/ANON_KEY 时抛出错误
 */
function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables. Please check your Cloudflare Pages / .env.local settings."
    );
  }

  // 关闭浏览器端会话持久化与 token 自动刷新，适合纯服务端/边缘场景使用
  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}

/**
 * 从 kl8_dimension_step 表查询全部维度步长数据，并按维度名称升序排列。
 *
 * @returns 维度步长数据数组；若查询结果为空则返回空数组
 * @throws 当 Supabase 查询发生错误时抛出错误，并附带原始错误信息
 */
export async function getAllDimensionSteps(): Promise<Kl8DimensionStep[]> {
  const { data, error } = await getSupabaseClient()
    .from("kl8_dimension_step")
    .select("*")
    .order("dimension", { ascending: true });

  if (error) {
    console.error("Error fetching kl8_dimension_step:", error);
    throw new Error(error.message);
  }

  return (data as Kl8DimensionStep[]) ?? [];
}

/** 带分页、排序、筛选的维度步长查询参数 */
export type DimensionQueryParams = {
  /** 1-based 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: 10 | 25 | 50 | 100;
  /** 排序列 */
  sortField: SortableKey;
  /** 排序方向 */
  sortDirection: SortDirection;
  /** 筛选条件 */
  filters: FilterState;
};

/** 带分页的维度步长查询结果 */
export type DimensionQueryResult = {
  /** 当前页数据 */
  rows: Kl8DimensionStep[];
  /** 符合筛选条件的总条数 */
  total: number;
};

/**
 * 根据查询参数从 kl8_dimension_step 表查询维度步长数据。
 * 在服务端完成筛选、排序、分页，仅返回当前页数据及总条数。
 *
 * @param params - 查询参数
 * @returns 当前页数据与总条数
 * @throws 当 Supabase 查询发生错误时抛出错误，并附带原始错误信息
 */
export async function getDimensionSteps(
  params: DimensionQueryParams
): Promise<DimensionQueryResult> {
  const { page, pageSize, sortField, sortDirection, filters } = params;

  let query = getSupabaseClient()
    .from("kl8_dimension_step")
    .select("*", { count: "exact" });

  // 维度名称模糊匹配（不区分大小写）
  if (filters.dimension.trim()) {
    query = query.ilike("dimension", `%${filters.dimension.trim()}%`);
  }

  // 数字列筛选
  const numberFields: Array<"max_step" | "current_distance" | "tuijian_num"> = [
    "max_step",
    "current_distance",
    "tuijian_num",
  ];
  for (const field of numberFields) {
    const filter = filters[field];
    const value = filter.value;

    if (filter.operator === "range") {
      if (filter.min !== null) {
        query = query.gte(field, filter.min);
      }
      if (filter.max !== null) {
        query = query.lte(field, filter.max);
      }
      continue;
    }

    if (value === null) continue;

    switch (filter.operator) {
      case ">":
        query = query.gt(field, value);
        break;
      case ">=":
        query = query.gte(field, value);
        break;
      case "=":
        query = query.eq(field, value);
        break;
      case "<=":
        query = query.lte(field, value);
        break;
      case "<":
        query = query.lt(field, value);
        break;
    }
  }

  // 排序与分页（Supabase range 为 0-based 闭区间）
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await query
    .order(sortField, { ascending: sortDirection === "asc" })
    .range(start, end);

  if (error) {
    console.error("Error fetching kl8_dimension_step:", error);
    throw new Error(error.message);
  }

  return {
    rows: (data as Kl8DimensionStep[]) ?? [],
    total: count ?? 0,
  };
}

/**
 * 根据查询参数从 kl8_dimension_step2 表查询维度双号推荐数据。
 * 在服务端完成筛选、排序、分页，仅返回当前页数据及总条数。
 * tuijian_num 为整数数组，支持输入一个或两个号码进行包含匹配。
 *
 * @param params - 查询参数
 * @param tuijianNum2 - 第二个推荐号码（可选），与 params.filters.tuijian_num.value 同时存在时表示需同时包含两个号码
 * @returns 当前页数据与总条数
 * @throws 当 Supabase 查询发生错误时抛出错误，并附带原始错误信息
 */
export async function getDimensionStep2s(
  params: DimensionQueryParams,
  tuijianNum2?: number | null
): Promise<{ rows: Kl8DimensionStep2[]; total: number }> {
  const { page, pageSize, sortField, sortDirection, filters } = params;

  let query = getSupabaseClient()
    .from("kl8_dimension_step2")
    .select("*", { count: "exact" });

  // 维度名称模糊匹配（不区分大小写）
  if (filters.dimension.trim()) {
    query = query.ilike("dimension", `%${filters.dimension.trim()}%`);
  }

  // 数字列筛选（标量列）
  const numberFields: Array<"max_step" | "current_distance"> = [
    "max_step",
    "current_distance",
  ];
  for (const field of numberFields) {
    const filter = filters[field];
    const value = filter.value;

    if (filter.operator === "range") {
      if (filter.min !== null) {
        query = query.gte(field, filter.min);
      }
      if (filter.max !== null) {
        query = query.lte(field, filter.max);
      }
      continue;
    }

    if (value === null) continue;

    switch (filter.operator) {
      case ">":
        query = query.gt(field, value);
        break;
      case ">=":
        query = query.gte(field, value);
        break;
      case "=":
        query = query.eq(field, value);
        break;
      case "<=":
        query = query.lte(field, value);
        break;
      case "<":
        query = query.lt(field, value);
        break;
    }
  }

  // 推荐号数组包含筛选：支持一个或两个号码，自动去重
  const tjValue = filters.tuijian_num.value;
  const nums = [
    ...(tjValue !== null ? [tjValue] : []),
    ...(tuijianNum2 !== null && tuijianNum2 !== undefined ? [tuijianNum2] : []),
  ];
  const uniqueNums = Array.from(new Set(nums));
  if (uniqueNums.length > 0) {
    query = query.contains("tuijian_num", uniqueNums);
  }

  // 排序与分页（Supabase range 为 0-based 闭区间）
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await query
    .order(sortField, { ascending: sortDirection === "asc" })
    .range(start, end);

  if (error) {
    console.error("Error fetching kl8_dimension_step2:", error);
    throw new Error(error.message);
  }

  return {
    rows: (data as Kl8DimensionStep2[]) ?? [],
    total: count ?? 0,
  };
}

/**
 * 开奖数据分页查询参数。
 */
export type BingoQueryParams = {
  /** 1-based 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
};

/**
 * 开奖数据分页查询结果。
 */
export type BingoQueryResult = {
  /** 当前页数据，按期号降序排列（最新期号在前） */
  rows: Kl8BingoRow[];
  /** 总条数 */
  total: number;
};

/**
 * 从 kl8_bingo_all 表按页查询开奖数据。
 * 结果按期号降序排列，最新一期为第一条；同时返回总条数用于分页。
 *
 * @param params - 分页参数
 * @returns 当前页数据与总条数
 * @throws 当 Supabase 查询发生错误时抛出错误，并附带原始错误信息
 */
export async function getBingoData(
  params: BingoQueryParams
): Promise<BingoQueryResult> {
  const { page, pageSize } = params;

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await getSupabaseClient()
    .from("kl8_bingo_all")
    .select("*", { count: "exact" })
    .order("issue", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("Error fetching kl8_bingo_all:", error);
    throw new Error(error.message);
  }

  return {
    rows: (data as Kl8BingoRow[]) ?? [],
    total: count ?? 0,
  };
}
