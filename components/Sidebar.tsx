"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavCategory, navigation } from "@/lib/navigation";

/**
 * 左侧菜单分类项组件。
 * 支持展开/折叠，并渲染其下的二级页面链接。
 */
function NavCategoryItem({ category }: { category: NavCategory }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const hasActiveChild = category.children.some((item) => item.href === pathname);

  return (
    <div className="border-b border-gray-800">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        aria-expanded={expanded}
      >
        <span>{category.label}</span>
        <span
          className={`text-xs transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>
      {expanded && (
        <ul className="pb-2">
          {category.children.map((item) => {
            const isActive = item.href === pathname;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-8 py-2 text-sm transition-colors ${
                    isActive
                      ? "border-l-4 border-blue-500 bg-gray-800 font-medium text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!expanded && hasActiveChild && (
        <div className="px-4 pb-2 text-xs text-blue-400">
          当前：{category.children.find((item) => item.href === pathname)?.label}
        </div>
      )}
    </div>
  );
}

/**
 * 左侧边栏导航组件。
 * 包含应用 Logo/标题、可折叠的一级模块分类、二级页面链接，
 * 并在移动端提供汉堡按钮展开/收起。
 */
export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* 移动端顶部导航栏 */}
      <header className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3 lg:hidden">
        <span className="text-lg font-bold text-white">彩票分析</span>
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="rounded p-2 text-gray-300 hover:bg-gray-800 hover:text-white"
          aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </header>

      {/* 侧边栏：桌面端固定；移动端根据 mobileOpen 显示/隐藏 */}
      <aside
        className={`fixed left-0 top-0 z-30 h-full w-64 transform bg-gray-900 text-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center border-b border-gray-800 px-4">
          <span className="text-lg font-bold">彩票分析</span>
        </div>
        <nav className="overflow-y-auto py-2">
          {navigation.map((category) => (
            <NavCategoryItem key={category.label} category={category} />
          ))}
        </nav>
      </aside>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
