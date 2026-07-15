/**
 * PostCSS 配置文件。
 * 仅注册 tailwindcss 插件，用于在构建时处理 Tailwind 工具类。
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    tailwindcss: {},
  },
};

export default config;
