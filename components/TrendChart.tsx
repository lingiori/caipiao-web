"use client";

import { useMemo } from "react";
import { Kl8BingoRow } from "@/lib/supabase";

/** 走势图组件 props */
type TrendChartProps = {
  /** 当前页要展示的开奖数据，按期号升序排列 */
  rows: Kl8BingoRow[];
};

/**
 * 将逗号分隔的开奖号码字符串解析为有序号码数组。
 *
 * @param bingoNum - 形如 "01,07,11,...,80" 的字符串
 * @returns 1-80 范围内的有效号码数组（已升序）
 */
function parseBingoNumbers(bingoNum: string): number[] {
  return bingoNum
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 80)
    .sort((a, b) => a - b);
}

/**
 * 快乐8基本走势图组件。
 *
 * 参照传统彩票走势图布局：
 * - 顶部横向表头：01-80 号码
 * - 左侧纵向表头：期号（按时间顺序自上而下）
 * - 命中位置以红色球体展示，球内显示对应号码
 *
 * SVG 使用 viewBox 自适应容器，保证全屏展示且无滚动条。
 */
export default function TrendChart({ rows }: TrendChartProps) {
  // 构建每期号码命中集合与排序后的号码数组
  const issueData = useMemo(() => {
    return rows.map((row) => ({
      issue: row.issue,
      numbers: parseBingoNumbers(row.bingo_num),
    }));
  }, [rows]);

  // 图表尺寸常量（单位：px，用于 viewBox 内部坐标）
  const issueColumnWidth = 64;
  const headerRowHeight = 28;
  const cellWidth = 22;
  const cellHeight = 22;
  const rightMargin = 8;
  const bottomMargin = 8;
  const ballRadius = Math.min(cellWidth, cellHeight) / 2 - 1.5;

  const chartWidth = issueColumnWidth + 80 * cellWidth + rightMargin;
  const chartHeight =
    headerRowHeight + rows.length * cellHeight + bottomMargin;

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-amber-200 bg-[#fffdf5] p-8 text-center text-gray-500">
        暂无开奖数据
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded-lg border border-amber-200 bg-[#fffdf5] shadow-sm">
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="max-h-full max-w-full"
          role="img"
          aria-label="快乐8基本走势图"
        >
          <defs>
            {/* 红色球体径向渐变，模拟彩票球光泽 */}
            <radialGradient
              id="ballGradient"
              cx="35%"
              cy="35%"
              r="65%"
              fx="30%"
              fy="30%"
            >
              <stop offset="0%" stopColor="#ff6b7a" />
              <stop offset="40%" stopColor="#e60012" />
              <stop offset="100%" stopColor="#b3000e" />
            </radialGradient>
            <filter
              id="ballShadow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1"
                floodColor="#000000"
                floodOpacity="0.15"
              />
            </filter>
          </defs>

          {/* 表头背景 */}
          <rect
            x={0}
            y={0}
            width={chartWidth}
            height={headerRowHeight}
            fill="#fff0e0"
          />
          <rect
            x={0}
            y={0}
            width={issueColumnWidth}
            height={chartHeight}
            fill="#fff7ed"
          />

          {/* 顶部表头：号码 01-80 */}
          {Array.from({ length: 80 }, (_, i) => {
            const number = i + 1;
            const x = issueColumnWidth + i * cellWidth + cellWidth / 2;
            const isTen = number % 10 === 0;
            return (
              <g key={`header-num-${number}`}>
                <rect
                  x={issueColumnWidth + i * cellWidth}
                  y={0}
                  width={cellWidth}
                  height={headerRowHeight}
                  fill={isTen ? "#ffe4cc" : "transparent"}
                />
                <text
                  x={x}
                  y={headerRowHeight / 2 + 4}
                  textAnchor="middle"
                  className="fill-gray-700 text-[10px] font-medium"
                >
                  {number.toString().padStart(2, "0")}
                </text>
              </g>
            );
          })}

          {/* 左侧表头：期号 */}
          {issueData.map((item, rowIndex) => {
            const y =
              headerRowHeight + rowIndex * cellHeight + cellHeight / 2;
            return (
              <g key={`header-issue-${item.issue}`}>
                <text
                  x={issueColumnWidth - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-gray-600 text-[10px]"
                >
                  {item.issue}
                </text>
              </g>
            );
          })}

          {/* 网格线 */}
          <g stroke="#f0dcc8" strokeWidth={1}>
            {/* 水平网格线 */}
            {Array.from({ length: rows.length + 1 }, (_, i) => (
              <line
                key={`h-line-${i}`}
                x1={issueColumnWidth}
                y1={headerRowHeight + i * cellHeight}
                x2={issueColumnWidth + 80 * cellWidth}
                y2={headerRowHeight + i * cellHeight}
              />
            ))}
            {/* 垂直网格线 */}
            {Array.from({ length: 81 }, (_, i) => (
              <line
                key={`v-line-${i}`}
                x1={issueColumnWidth + i * cellWidth}
                y1={0}
                x2={issueColumnWidth + i * cellWidth}
                y2={headerRowHeight + rows.length * cellHeight}
              />
            ))}
          </g>

          {/* 每隔 5 列的浅底色分隔带，方便纵向读数 */}
          {Array.from({ length: 16 }, (_, i) => {
            const startNumber = i * 5;
            return (
              <rect
                key={`band-${i}`}
                x={issueColumnWidth + startNumber * cellWidth}
                y={headerRowHeight}
                width={cellWidth * 5}
                height={rows.length * cellHeight}
                fill={i % 2 === 0 ? "#fffaf2" : "#ffffff"}
                opacity={0.6}
                pointerEvents="none"
              />
            );
          })}

          {/* 重绘网格线（覆盖在色带之上，保持线条清晰） */}
          <g stroke="#f0dcc8" strokeWidth={1}>
            {Array.from({ length: rows.length + 1 }, (_, i) => (
              <line
                key={`h-line-cover-${i}`}
                x1={issueColumnWidth}
                y1={headerRowHeight + i * cellHeight}
                x2={issueColumnWidth + 80 * cellWidth}
                y2={headerRowHeight + i * cellHeight}
              />
            ))}
            {Array.from({ length: 81 }, (_, i) => (
              <line
                key={`v-line-cover-${i}`}
                x1={issueColumnWidth + i * cellWidth}
                y1={headerRowHeight}
                x2={issueColumnWidth + i * cellWidth}
                y2={headerRowHeight + rows.length * cellHeight}
              />
            ))}
          </g>

          {/* 命中红色球体 */}
          {issueData.map((item, rowIndex) =>
            item.numbers.map((number) => {
              const cx =
                issueColumnWidth + (number - 1) * cellWidth + cellWidth / 2;
              const cy =
                headerRowHeight + rowIndex * cellHeight + cellHeight / 2;

              return (
                <g key={`ball-${item.issue}-${number}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={ballRadius}
                    fill="url(#ballGradient)"
                    filter="url(#ballShadow)"
                    className="cursor-pointer"
                  />
                  <text
                    x={cx}
                    y={cy + 3}
                    textAnchor="middle"
                    className="fill-white text-[9px] font-bold"
                  >
                    {number.toString().padStart(2, "0")}
                  </text>
                </g>
              );
            })
          )}

          {/* 表头文字覆盖（确保不会被网格线遮挡） */}
          {Array.from({ length: 80 }, (_, i) => {
            const number = i + 1;
            const x = issueColumnWidth + i * cellWidth + cellWidth / 2;
            return (
              <text
                key={`header-num-cover-${number}`}
                x={x}
                y={headerRowHeight / 2 + 4}
                textAnchor="middle"
                className="fill-gray-700 text-[10px] font-medium"
              >
                {number.toString().padStart(2, "0")}
              </text>
            );
          })}

          {issueData.map((item, rowIndex) => {
            const y =
              headerRowHeight + rowIndex * cellHeight + cellHeight / 2;
            return (
              <text
                key={`header-issue-cover-${item.issue}`}
                x={issueColumnWidth - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-gray-600 text-[10px]"
              >
                {item.issue}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
