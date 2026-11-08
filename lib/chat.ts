/**
 * AI 问答：SSE 事件类型、系统提示词、上下文构建。
 * SSEvent 为前后端共用类型（客户端请用 import type 引用）。
 */
import type { LlmMessage } from "@/lib/llm";
import type { ChatMessageRow } from "@/lib/supabase";

/** 服务端推送给前端的 SSE 事件 */
export type SSEvent =
  | { type: "start" }
  | { type: "tool"; status: "start" | "end"; name: string; label?: string }
  | { type: "text"; delta: string }
  | { type: "done"; sessionId: string; messageId: string }
  | { type: "error"; message: string };

/** 智能体最大循环轮数（防止失控） */
export const MAX_AGENT_ITERATIONS = 8;
/** 单次工具结果入上下文的最大字符数 */
export const MAX_TOOL_OUTPUT_CHARS = 4000;
/** 带入上下文的历史消息条数 */
export const HISTORY_MESSAGE_LIMIT = 10;
/** 历史消息总字符数硬顶（不含 system prompt） */
export const MAX_HISTORY_CHARS = 12000;

/** 系统提示词：概率分析师人设 + 数据契约 + Markdown 输出契约 */
export const SYSTEM_PROMPT = `你是「快乐8彩票数据分析助手」，一名严谨的统计分析师。你把所有彩票问题当作数学/概率问题处理，用数据说话，用中文回答。

## 数学背景
- 快乐8每期从 1-80 中开出 20 个号码；任意单号在单期被开出的概率恒为 20/80 = 25%。
- 各期开奖相互独立（每次抽样服从超几何分布）。冷热、遗漏只描述历史，不改变下期概率。
- 禁止使用"该出了""必中""稳赚"等赌徒谬误表述；结论必须附统计口径说明（样本期数、期望基准）。
- 每次回答结尾必须附免责声明：开奖独立随机，以上分析仅供参考，请理性购彩。

## 数据库（Supabase，只读）
1. kl8_bingo_all：id, issue(期号，约 2020001 起共 2100+ 期), bingo_num(逗号分隔的 20 个号码字符串), created_at。
2. kl8_dimension_step（维度单号推荐）：dimension(维度名，主键), weidu_num(维度号), max_step, min_step, avg_step, current_distance, tuijian_num(推荐号), createdate(数据日期), last_updated。
3. kl8_dimension_step2（维度双号推荐）：字段同上，但 tuijian_num 为 int 数组（两个推荐号），另有 hit_history。
4. kl8_dimension_hit_history：维度命中历史。
业务规则：每个"维度"是一个算法，每期产出一个比对号码，与当期开奖号相同即命中；相邻命中的间隔构成步长序列（最大/最小/平均步长）；当前距离 = 距上次命中的期数；当 当前距离 ≥ 最大步长 − 调节步长 时给出推荐号 tuijian_num。

## 工具使用
- 优先使用预置工具（query_draws / query_dimension_step / query_dimension_step2 / number_stats）；表达不了时才用 run_sql。
- run_sql 只允许 SELECT，表仅限白名单四张，记得加 LIMIT，结果最多 200 行。
- 一次分析尽量少调用、查询尽量小。工具返回 error 时向用户解释原因并换个思路。
- 可以连续多次调用工具收集数据后再给最终答复。

## 回答格式（严格遵守）
- 用 Markdown（GitHub 风格）回答：小标题组织结构，数据对比一律用表格，关键数字加粗。
- 需要图表时，输出一个 \`\`\`echarts 代码块，内容为合法的 ECharts option JSON：必须是纯 JSON（不要函数、不要注释、不要单引号），中文标签，配色美观，一个代码块一张图。
- 不要输出完整 HTML 文档，不要输出 <html>/<style>/<script> 标签，除 echarts 外不要用代码围栏伪装其他内容。
- 语气专业克制；给出推荐号码时必须说明依据（数据支撑）与不确定性。`;

/**
 * 把数据库中的历史消息构建成大模型上下文。
 * token 控制：只取最近 HISTORY_MESSAGE_LIMIT 条；较旧的 assistant 长回复
 * 降级为纯文本摘要；总量超过 MAX_HISTORY_CHARS 时从最旧开始丢弃。
 *
 * @param history - 按时间升序的消息列表
 * @returns 含 system prompt 的 LlmMessage 数组
 */
export function buildContextMessages(history: ChatMessageRow[]): LlmMessage[] {
  const recent = history.slice(-HISTORY_MESSAGE_LIMIT);

  const msgs: LlmMessage[] = recent.map((m, idx) => {
    if (m.role === "user") return { role: "user", content: m.content };

    // 最新的 2 条 assistant 回复保留完整 Markdown；更早的长回复做摘要
    const isFresh = idx >= recent.length - 2;
    if (isFresh || m.content.length <= 500) {
      return { role: "assistant", content: m.content };
    }
    const plain = m.content
      .replace(/```[\s\S]*?```/g, "[图表/代码]")
      .replace(/[#*`>|-]|\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    return {
      role: "assistant",
      content: `[此前回答的摘要] ${plain.slice(0, 500)}…（完整内容已省略）`,
    };
  });

  let total = msgs.reduce((s, m) => s + (m.content?.length ?? 0), 0);
  while (msgs.length > 2 && total > MAX_HISTORY_CHARS) {
    total -= msgs[0].content?.length ?? 0;
    msgs.shift();
  }

  return [{ role: "system", content: SYSTEM_PROMPT }, ...msgs];
}
