This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 功能

快乐8彩票数据分析平台，数据存于 Supabase：

- **走势图**（`/`）：历史开奖数据分页浏览
- **维度单号推荐**（`/kl8/dimensions`）：维度步长统计表，服务端分页/排序/筛选
- **维度双号推荐**（`/kl8/dimensions-step2`）：双号推荐表
- **AI 问答**（`/chat`）：AI 智能体问答，自动查询数据库做概率分析并给出推荐；DeepSeek 风格多会话界面，回答以 Markdown + ECharts 图表渲染

### AI 问答配置

1. 在 Supabase SQL 编辑器执行一次 `scripts/chat-migration.sql`（只新增 `chat_sessions`、`chat_messages` 两张表和只读 SQL 函数，不动现有数据）。
2. 配置模型 key（二选一，环境变量优先）：
   - 填 `ai.config.json` 的 `kimi.apiKey`（**真实 key 不要提交**：`git update-index --skip-worktree ai.config.json`）
   - 或在 `.env.local` 设 `KIMI_API_KEY`；Cloudflare Pages 在控制台环境变量中配置
3. 默认 Kimi（模型 `k3`）；切换到 DeepSeek：设 `AI_PROVIDER=deepseek` 并填 `DEEPSEEK_API_KEY`。
4. **登录账号**：`/chat` 页面需账号密码访问，账号配置在 `ai.config.json` 的 `auth.users`（密码存 SHA-256 哈希）。新增账号：`echo -n "密码" | sha256sum` 生成哈希后追加一行即可。会话有效期 7 天（cookie 由 `auth.sessionSecret` 签名；**部署到 Cloudflare 时需在环境变量配置 `AUTH_SESSION_SECRET`**，因为仓库里的 `ai.config.json` 只保留不含密钥的净化版）。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
