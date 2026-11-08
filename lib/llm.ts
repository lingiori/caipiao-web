/**
 * 大模型客户端（OpenAI 兼容，plain fetch，edge 运行时安全）。
 * 默认走 Kimi（Kimi For Coding），DeepSeek 作备选，两家 API 形状一致。
 *
 * 配置解析优先级：环境变量 > ai.config.json。
 * ai.config.json 在构建时打包进服务端 bundle（Cloudflare Workers 无 fs），
 * 且只被 API 路由引用，不会进入浏览器 bundle。
 */
import aiConfig from "@/ai.config.json";

/** 发给大模型的消息结构 */
export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
};

/** 一次工具调用（function calling） */
export type LlmToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** 工具定义（JSON schema） */
export type LlmToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** 流式事件：文本增量 / 结束（含累积完成的工具调用列表） */
export type LlmStreamEvent =
  | { type: "text"; delta: string }
  | { type: "finish"; finishReason: string; toolCalls: LlmToolCall[] };

type ProviderName = "kimi" | "deepseek";

/**
 * 解析当前生效的模型供应商配置。
 * 环境变量覆盖配置文件；函数内读取，避免构建期内联问题。
 */
function resolveProvider(): {
  name: ProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  const active = (process.env.AI_PROVIDER ||
    aiConfig.activeProvider) as ProviderName;

  if (active === "deepseek") {
    return {
      name: "deepseek",
      apiKey: process.env.DEEPSEEK_API_KEY || aiConfig.providers.deepseek.apiKey,
      baseUrl:
        process.env.DEEPSEEK_BASE_URL || aiConfig.providers.deepseek.baseUrl,
      model: process.env.DEEPSEEK_MODEL || aiConfig.providers.deepseek.model,
    };
  }
  return {
    name: "kimi",
    apiKey: process.env.KIMI_API_KEY || aiConfig.providers.kimi.apiKey,
    baseUrl: process.env.KIMI_BASE_URL || aiConfig.providers.kimi.baseUrl,
    model: process.env.KIMI_MODEL || aiConfig.providers.kimi.model,
  };
}

/** SSE chunk 的最小类型（避免 any） */
type SseChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
};

/**
 * 流式调用 chat/completions（带工具定义）。
 * text delta 即时 yield；tool_calls 的参数以分片形式到达，按 index 累积，
 * 在 finish 事件里返回完整列表。
 *
 * @param messages - 完整上下文（含 system）
 * @param tools - 可用工具定义
 * @param signal - 可选 AbortSignal（客户端断开时中止上游请求）
 */
export async function* streamChatCompletion(
  messages: LlmMessage[],
  tools: LlmToolDef[],
  signal?: AbortSignal
): AsyncGenerator<LlmStreamEvent> {
  const { name, apiKey, baseUrl, model } = resolveProvider();

  if (!apiKey) {
    throw new Error(
      `未配置 ${name === "kimi" ? "KIMI" : "DEEPSEEK"}_API_KEY，` +
        `请在 ai.config.json 或环境变量中设置`
    );
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      stream: true,
      // Kimi k3 只接受 temperature=1，传其他值会报 invalid_request_error
      temperature: 1,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`大模型接口错误 ${res.status}: ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const acc: LlmToolCall[] = [];
  let finishReason = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        yield { type: "finish", finishReason, toolCalls: acc };
        return;
      }

      let chunk: SseChunk;
      try {
        chunk = JSON.parse(payload) as SseChunk;
      } catch {
        continue;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta ?? {};

      if (typeof delta.content === "string" && delta.content) {
        yield { type: "text", delta: delta.content };
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const i = tc.index ?? 0;
          if (!acc[i]) {
            acc[i] = {
              id: tc.id ?? `call_${i}`,
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          if (tc.id) acc[i].id = tc.id;
          if (tc.function?.name) acc[i].function.name += tc.function.name;
          if (tc.function?.arguments)
            acc[i].function.arguments += tc.function.arguments;
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  yield { type: "finish", finishReason, toolCalls: acc };
}
