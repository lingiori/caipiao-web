/**
 * 侧边栏二级菜单项：链接标签与目标路由。
 */
export type NavItem = {
  /** 菜单显示文本 */
  label: string;
  /** 目标页面 href */
  href: string;
};

/**
 * 侧边栏一级菜单分类：用于模块归类与折叠。
 */
export type NavCategory = {
  /** 分类名称 */
  label: string;
  /** 该分类下的二级页面链接 */
  children: NavItem[];
};

/**
 * 应用全局导航配置。
 * 按模块分类组织，后续新增彩种时在此数组中追加分类即可。
 */
export const navigation: NavCategory[] = [
  {
    label: "快乐8",
    children: [
      { label: "走势图", href: "/" },
      { label: "维度步长", href: "/kl8/dimensions" },
      { label: "维度双号推荐", href: "/kl8/dimensions-step2" },
    ],
  },
];
