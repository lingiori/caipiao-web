import { NextRequest, NextResponse } from "next/server";
import { streamChatCompletion, type LlmMessage, type LlmToolCall } from "@/lib/llm";
import { AGENT_TOOLS, TOOL_LABELS, executeAgentTool } from "@/lib/agent-tools";
import {
  type SSEvent,
  MAX_AGENT_ITERATIONS,
  MAX_TOOL_OUTPUT_CHARS,
  buildContextMessages,
} from "@/lib/chat";
import {
  createChatSession,
  insertChatMessage,
  listChatMessages,
  touchChatSession,
} from "@/lib/supabase";

/** 边缘运行时，适配 Cloudflare Pages */
export const runtime = "edge";

/**
 * AI 问答主接口。
 * POST { sessionId?: string, message: string } → SSE 流：
 * start → (text | tool)* → done / error。
 * 服务端在流内执行智能体循环（LLM ↔ 工具），最终答案落库后发 done。
 */
export async function POST(request: NextRequest) {
  let body: { sessionId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "消息过长（限 4000 字）" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: SSEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)
        );

      try {
        send({ type: "start" });

        // 1. 确定会话：无 sessionId 则新建（标题取消息前 20 字）
        let sessionId = body.sessionId ?? null;
        if (!sessionId) {
          const session = await createChatSession(message.slice(0, 20));
          sessionId = session.id;
        }

        // 2. 持久化用户消息并刷新会话排序
        await insertChatMessage({
          session_id: sessionId,
          role: "user",
          content: message,
        });
        await touchChatSession(sessionId);

        // 3. 构建上下文（含刚写入的用户消息）
        const history = await listChatMessages(sessionId);
        const messages: LlmMessage[] = buildContextMessages(history);

        // 4. 智能体循环：LLM ↔ 工具，直到模型给出最终文本
        let finalText: string | null = null;

        for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
          let textBuf = "";
          let toolCalls: LlmToolCall[] = [];

          for await (const ev of streamChatCompletion(
            messages,
            AGENT_TOOLS,
            request.signal
          )) {
            if (ev.type === "text") {
              textBuf += ev.delta;
              send({ type: "text", delta: ev.delta });
            } else if (ev.type === "finish") {
              toolCalls = ev.toolCalls;
            }
          }

          if (toolCalls.length === 0) {
            finalText = textBuf;
            break;
          }

          // 把 assistant 的工具调用请求入上下文
          messages.push({
            role: "assistant",
            content: textBuf || null,
            tool_calls: toolCalls,
          });

          // 逐个执行工具并把结果入上下文
          for (const call of toolCalls) {
            send({
              type: "tool",
              status: "start",
              name: call.function.name,
              label:
                TOOL_LABELS[call.function.name] ??
                `正在执行 ${call.function.name}…`,
            });

            const result = await executeAgentTool(
              call.function.name,
              call.function.arguments
            );

            send({ type: "tool", status: "end", name: call.function.name });

            let json = JSON.stringify(result) ?? "null";
            if (json.length > MAX_TOOL_OUTPUT_CHARS) {
              json = json.slice(0, MAX_TOOL_OUTPUT_CHARS) + "…(结果已截断)";
            }
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: json,
            });
          }
        }

        if (finalText === null) {
          finalText =
            "已达到最大分析步数（8 轮），问题可能过于复杂，请缩小范围后重试。";
        }
        finalText = finalText.trim() || "（模型未返回内容）";

        // 5. 落库 assistant 回复
        const saved = await insertChatMessage({
          session_id: sessionId,
          role: "assistant",
          content: finalText,
        });
        await touchChatSession(sessionId);

        send({ type: "done", sessionId, messageId: saved.id });
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "服务内部错误",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
