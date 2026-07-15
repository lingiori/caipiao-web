import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  title: "快乐8 维度信息",
  description: "基于 Supabase kl8_dimension_step 表展示快乐8彩票维度数据",
};

/**
 * 根布局组件。
 * 为整个应用设置 html/body 结构、CSS 变量字体与语言属性，
 * 所有页面组件都会作为 children 渲染在 body 中。
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
        {children}
      </body>
    </html>
  );
}
