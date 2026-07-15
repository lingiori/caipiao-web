/**
 * Next.js 配置文件。
 * 由于项目使用 Cloudflare Pages 静态部署，关闭 Next.js 图片优化服务，
 * 避免构建产物依赖 Vercel 图片优化 API。
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
