"use client";

import { useEffect, useRef, useState } from "react";

/** ECharts 全局 API 的最小类型（避免 any） */
type EChartsInstance = {
  setOption(option: unknown): void;
  resize(): void;
  dispose(): void;
};
type EChartsApi = {
  init(el: HTMLElement): EChartsInstance;
};

declare global {
  interface Window {
    echarts?: EChartsApi;
    __echartsLoading?: Promise<EChartsApi>;
  }
}

/** CDN 地址（全站唯一注入点） */
const ECHARTS_CDN =
  "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";

/**
 * 按需从 CDN 加载 ECharts（全局只注入一次 script）。
 */
function loadEcharts(): Promise<EChartsApi> {
  if (window.echarts) return Promise.resolve(window.echarts);
  if (!window.__echartsLoading) {
    window.__echartsLoading = new Promise<EChartsApi>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = ECHARTS_CDN;
      s.onload = () =>
        window.echarts
          ? resolve(window.echarts)
          : reject(new Error("ECharts 初始化失败"));
      s.onerror = () => reject(new Error("ECharts 加载失败（CDN 不可达）"));
      document.head.appendChild(s);
    });
  }
  return window.__echartsLoading;
}

/**
 * 渲染 ```echarts 代码块：内容为 ECharts option JSON。
 * JSON 非法或 CDN 加载失败时回退为源码块展示。
 */
export default function EChartsBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let option: unknown;
    try {
      option = JSON.parse(code);
    } catch {
      setError("图表配置不是合法 JSON");
      return;
    }

    let disposed = false;
    let chart: EChartsInstance | null = null;
    let observer: ResizeObserver | null = null;

    loadEcharts()
      .then((echarts) => {
        if (disposed || !containerRef.current) return;
        chart = echarts.init(containerRef.current);
        try {
          chart.setOption(option);
        } catch {
          setError("图表配置渲染失败");
          return;
        }
        observer = new ResizeObserver(() => chart?.resize());
        if (containerRef.current) observer.observe(containerRef.current);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "ECharts 加载失败")
      );

    return () => {
      disposed = true;
      observer?.disconnect();
      chart?.dispose();
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-3">
        <div className="rounded-t-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          图表渲染失败：{error}，显示原始配置
        </div>
        <pre className="overflow-x-auto rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 h-80 w-full rounded-lg border border-gray-200 bg-white"
    />
  );
}
