import { createClient, SupabaseClient } from "@supabase/supabase-js";

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
