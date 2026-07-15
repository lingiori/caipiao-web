import type { Config } from "tailwindcss";

/**
 * Tailwind CSS 配置文件。
 * 扫描 pages、components、app 目录下的所有组件文件，
 * 并扩展主题色以支持 CSS 变量定义的背景色与前景色。
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
