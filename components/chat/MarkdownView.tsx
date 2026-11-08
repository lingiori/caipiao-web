"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import EChartsBlock from "./EChartsBlock";

/**
 * Markdown 渲染器（assistant 消息用）。
 * - GFM：支持表格、删除线等
 * - ```echarts 代码块 → EChartsBlock 渲染图表
 * - 不允许原始 HTML（react-markdown 默认行为，防注入）
 * 样式由 globals.css 中的 .chat-markdown 系列类提供。
 */
export default function MarkdownView({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const raw = String(children).replace(/\n$/, "");
            if (match && match[1] === "echarts") {
              return <EChartsBlock code={raw} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
