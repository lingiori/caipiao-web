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
  experimental: {
    // 本地 Windows 上 next build 的 build worker 会报 spawn UNKNOWN（libuv 已知问题），
    // 限制为单 worker 可绕过；Cloudflare 构建在 Linux 上运行，不受影响
    cpus: 1,
  },
};

export default nextConfig;
