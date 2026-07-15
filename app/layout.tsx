import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

/** Geist Sans 可变字体配置，用于页面正文与标题 */
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

/** Geist Mono 等宽可变字体配置，用于代码或等宽场景 */
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

/** 页面元数据：标题与 SEO 描述 */
export const metadata: Metadata = {
  title: "彩票分析",
  description: "基于 Supabase 的快乐8彩票数据分析平台",
};

/**
 * 根布局组件。
 * 为整个应用设置 html/body 结构、CSS 变量字体与语言属性，
 * 并渲染持久化的左侧边栏；页面内容位于侧边栏右侧主内容区。
 *
 * @param children - 子页面节点
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Sidebar />
        <main className="min-h-screen bg-gray-100 pt-14 lg:ml-64 lg:pt-0">
          {children}
        </main>
      </body>
    </html>
  );
}
