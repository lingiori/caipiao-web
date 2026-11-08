/**
 * AI 智能体的数据查询工具集（原则 1：对 kl8_* 业务表全部只读）。
 * 每个工具的执行器永不抛错——异常转成 { error } 返回给模型自行恢复。
 */
import { getSupabaseClient } from "@/lib/supabase";
import type { LlmToolDef } from "@/lib/llm";

/** 工具名 → 前端展示的中文状态文案 */
export const TOOL_LABELS: Record<string, string> = {
  query_draws: "正在查询开奖数据…",
  query_dimension_step: "正在查询单号推荐维度…",
  query_dimension_step2: "正在查询双号推荐维度…",
  number_stats: "正在统计号码频次与遗漏…",
  run_sql: "正在执行只读分析 SQL…",
};

/** 工具 JSON schema 定义（发给大模型） */
export const AGENT_TOOLS: LlmToolDef[] = [
  {
    type: "function",
    function: {
      name: "query_draws",
      description:
        "查询快乐8历史开奖数据（kl8_bingo_all），按期号倒序返回，每期含解析好的 20 个号码数组。",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "返回期数，1-100，默认 20" },
          issue_from: { type: "number", description: "起始期号（含），可选" },
          issue_to: { type: "number", description: "截止期号（含），可选" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_dimension_step",
      description:
        "查询维度单号推荐表（kl8_dimension_step）。维度是预计算的算法统计：max_step/min_step/avg_step 为命中步长统计，current_distance 为当前遗漏期数，tuijian_num 为推荐号，weidu_num 为维度号。按 current_distance 倒序。",
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "维度名称模糊匹配，可选" },
          createdate: {
            type: "string",
            description: "数据日期 YYYY-MM-DD，可选",
          },
          min_current_distance: {
            type: "number",
            description: "当前距离下限，可选（找接近推荐的维度）",
          },
          limit: { type: "number", description: "返回条数，默认 50，最大 200" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_dimension_step2",
      description:
        "查询维度双号推荐表（kl8_dimension_step2）。tuijian_num 为两个推荐号的数组，可按包含号码筛选。",
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "维度名称模糊匹配，可选" },
          contains_numbers: {
            type: "array",
            items: { type: "number" },
            description: "推荐号需同时包含的号码（1-2 个），可选",
          },
          min_current_distance: { type: "number", description: "当前距离下限，可选" },
          limit: { type: "number", description: "返回条数，默认 50，最大 200" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "number_stats",
      description:
        "对最近 N 期开奖做频次/遗漏统计（服务端实时计算）：返回最热、最冷、当前遗漏最长的号码，以及指定号码的详细统计。",
      parameters: {
        type: "object",
        properties: {
          last_n: {
            type: "number",
            description: "统计最近多少期，10-500，默认 100",
          },
          numbers: {
            type: "array",
            items: { type: "number" },
            description: "需要详细统计的号码（1-80），可选",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sql",
      description:
        "执行只读 SQL（兜底工具，预置工具表达不了时才用）。只允许 SELECT；表仅限 kl8_bingo_all、kl8_dimension_step、kl8_dimension_step2、kl8_dimension_hit_history；结果最多 200 行。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "SELECT 语句，建议带 LIMIT" },
        },
        required: ["query"],
      },
    },
  },
];

/* ---------- 参数解析小工具 ---------- */

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : def;
  return Math.min(Math.max(n, min), max);
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* ---------- 各工具执行器 ---------- */

/** 查询历史开奖数据，附解析后的号码数组 */
async function queryDraws(args: Record<string, unknown>) {
  const limit = clampInt(args.limit, 20, 1, 100);
  let q = getSupabaseClient()
    .from("kl8_bingo_all")
    .select("issue, bingo_num");

  if (typeof args.issue_from === "number") q = q.gte("issue", args.issue_from);
  if (typeof args.issue_to === "number") q = q.lte("issue", args.issue_to);

  const { data, error } = await q
    .order("issue", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    issue: r.issue as number,
    numbers: String(r.bingo_num)
      .split(",")
      .map((s) => parseInt(s.trim(), 10)),
  }));
  return { rows, count: rows.length };
}

/** 查询单号推荐维度表 */
async function queryDimensionStep(args: Record<string, unknown>) {
  let q = getSupabaseClient().from("kl8_dimension_step").select("*");

  const dim = asStr(args.dimension);
  if (dim) q = q.ilike("dimension", `%${dim}%`);

  const cd = asStr(args.createdate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(cd)) {
    const next = new Date(`${cd}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    q = q.gte("createdate", cd).lt("createdate", next.toISOString().slice(0, 10));
  }

  if (typeof args.min_current_distance === "number") {
    q = q.gte("current_distance", args.min_current_distance);
  }

  const { data, error } = await q
    .order("current_distance", { ascending: false })
    .limit(clampInt(args.limit, 50, 1, 200));
  if (error) throw new Error(error.message);
  return { rows: data ?? [], count: data?.length ?? 0 };
}

/** 查询双号推荐维度表（tuijian_num 为数组，支持包含筛选） */
async function queryDimensionStep2(args: Record<string, unknown>) {
  let q = getSupabaseClient().from("kl8_dimension_step2").select("*");

  const dim = asStr(args.dimension);
  if (dim) q = q.ilike("dimension", `%${dim}%`);

  if (Array.isArray(args.contains_numbers)) {
    const nums = Array.from(
      new Set(
        args.contains_numbers.filter(
          (n): n is number => typeof n === "number" && n >= 1 && n <= 80
        )
      )
    ).slice(0, 2);
    if (nums.length > 0) q = q.contains("tuijian_num", nums);
  }

  if (typeof args.min_current_distance === "number") {
    q = q.gte("current_distance", args.min_current_distance);
  }

  const { data, error } = await q
    .order("current_distance", { ascending: false })
    .limit(clampInt(args.limit, 50, 1, 200));
  if (error) throw new Error(error.message);
  return { rows: data ?? [], count: data?.length ?? 0 };
}

/** 单个号码的统计结果 */
type NumberStat = {
  n: number;
  count: number;
  currentOmission: number;
  maxOmission: number;
};

/** 对最近 N 期开奖做频次/遗漏统计（JS 实时计算） */
async function numberStats(args: Record<string, unknown>) {
  const lastN = clampInt(args.last_n, 100, 10, 500);

  const { data, error } = await getSupabaseClient()
    .from("kl8_bingo_all")
    .select("issue, bingo_num")
    .order("issue", { ascending: false })
    .limit(lastN);
  if (error) throw new Error(error.message);

  // 转按期号升序，便于计算遗漏
  const draws = (data ?? [])
    .map((r) => ({
      issue: r.issue as number,
      nums: String(r.bingo_num)
        .split(",")
        .map((s) => parseInt(s.trim(), 10)),
    }))
    .reverse();

  const N = draws.length;
  const freq = new Array<number>(81).fill(0);
  const lastSeen = new Array<number>(81).fill(-1);
  const maxOmit = new Array<number>(81).fill(0);

  draws.forEach((d, i) => {
    for (const n of d.nums) {
      if (n < 1 || n > 80) continue;
      maxOmit[n] = Math.max(
        maxOmit[n],
        lastSeen[n] === -1 ? i : i - lastSeen[n] - 1
      );
      lastSeen[n] = i;
      freq[n]++;
    }
  });

  const all: NumberStat[] = [];
  for (let n = 1; n <= 80; n++) {
    all.push({
      n,
      count: freq[n],
      currentOmission: lastSeen[n] === -1 ? N : N - 1 - lastSeen[n],
      maxOmission: maxOmit[n],
    });
  }

  const byCountDesc = [...all].sort((a, b) => b.count - a.count || a.n - b.n);
  const byCountAsc = [...all].sort((a, b) => a.count - b.count || a.n - b.n);
  const byOmission = [...all].sort(
    (a, b) => b.currentOmission - a.currentOmission || a.n - b.n
  );

  const requested = Array.isArray(args.numbers)
    ? all.filter((s) =>
        (args.numbers as unknown[]).some(
          (m) => typeof m === "number" && Math.floor(m) === s.n
        )
      )
    : undefined;

  return {
    drawsAnalyzed: N,
    issueRange: N > 0 ? [draws[0].issue, draws[N - 1].issue] : null,
    expectedCount: Math.round(((N * 20) / 80) * 10) / 10,
    hot10: byCountDesc.slice(0, 10),
    cold10: byCountAsc.slice(0, 10),
    longestCurrentOmission10: byOmission.slice(0, 10),
    requested,
  };
}

/** 受限只读 SQL（数据库函数做白名单与超时校验） */
async function runSql(args: Record<string, unknown>) {
  const query = asStr(args.query);
  if (!query) return { error: "query 不能为空" };

  const { data, error } = await getSupabaseClient().rpc(
    "execute_readonly_sql",
    { query }
  );
  if (error) throw new Error(error.message);
  return { rows: data ?? [] };
}

/**
 * 工具执行入口。永不抛错：参数解析失败、执行异常都以
 * { error: string } 形式返回给模型，让其自行恢复或向用户解释。
 */
export async function executeAgentTool(
  name: string,
  argsJson: string
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return { error: `工具参数不是合法 JSON: ${argsJson.slice(0, 200)}` };
  }

  try {
    switch (name) {
      case "query_draws":
        return await queryDraws(args);
      case "query_dimension_step":
        return await queryDimensionStep(args);
      case "query_dimension_step2":
        return await queryDimensionStep2(args);
      case "number_stats":
        return await numberStats(args);
      case "run_sql":
        return await runSql(args);
      default:
        return { error: `未知工具: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
