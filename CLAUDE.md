# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

快乐8 (KL8) 彩票数据分析平台。UI 文案和代码注释均为中文。只读展示 Supabase 中预计算的开奖数据与号码推荐数据 — 应用本身不计算推荐。

## Commands

- `npm run dev` — dev server (port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint (next lint)
- `npx tsc --noEmit` — type check
- `npm run pages:build` / `npm run pages:deploy` — build & deploy to Cloudflare Pages via `@cloudflare/next-on-pages` + wrangler

No test framework is configured. Verify changes with `tsc --noEmit`, `lint`, and `build` — do not start the dev server yourself; ask the user to run it if interactive verification is needed.

## Environment variables

Copy `.env.local.example` to `.env.local`. `lib/supabase.ts` resolves them with a fallback chain: server-side `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) first, then `NEXT_PUBLIC_*` variants. Either pair works.

## Architecture

**Deployment target shapes the code.** The app deploys to Cloudflare Pages, so every API route sets `export const runtime = "edge"` (required by `@cloudflare/next-on-pages`) and `next.config.mjs` sets `images.unoptimized`. New API routes must also be edge runtime.

**Data flow: client page → edge API route → Supabase.** Pages under `app/` are client components (`"use client"`) that fetch their matching `/api/*` route. All Supabase access lives in `lib/supabase.ts` (singleton client, server-side only) and does filtering/sorting/pagination with the Supabase query builder — API routes never return full tables.

**The URL query-string is the contract.** `lib/table-utils.ts` owns the shared state model (`FilterState`, `SortState`, `PaginationState`) plus both sides of serialization: `buildDimensionQueryString` (client → URL) and `parseDimensionQueryParams` (route → state). When adding a filter or sortable column, update this file and the corresponding query builder in `lib/supabase.ts` together, or the client and server will silently disagree.

**Supabase tables** (row types defined in `lib/supabase.ts`):
- `kl8_bingo_all` — raw draw history, `bingo_num` is a comma-separated string of 20 numbers
- `kl8_dimension_step` — single-number recommendations (`tuijian_num` scalar)
- `kl8_dimension_step2` — double-number recommendations; `tuijian_num` is an **integer array** filtered with `.contains()`, which is why `/api/dimensions-step2` accepts an extra `tuijian_num2_value` param outside the standard filter scheme

**Navigation** is data-driven: add pages to the `navigation` array in `lib/navigation.ts` and they appear in the `Sidebar`. Each lottery game gets its own category; routes are grouped under `app/<game>/`.

**AI chat (`/chat`)** is the one write-capable and LLM-calling part of the app, and it breaks two conventions above: `number_stats` computes stats server-side, and the app writes to two **new** tables (`chat_sessions`, `chat_messages`) — `kl8_*` business tables stay strictly read-only (user's "原则 1"). Flow: `app/chat/page.tsx` → SSE `app/api/chat/route.ts` → agent loop (`lib/llm.ts`, OpenAI-compatible Kimi/DeepSeek via plain fetch) ↔ tools (`lib/agent-tools.ts`: preset Supabase queries + `run_sql` backed by the `execute_readonly_sql` Postgres function with SELECT-only/whitelist/timeout guards). Provider config: `ai.config.json` (bundled at build time, Workers has no fs) with env-var override (`KIMI_API_KEY` etc. take precedence). Kimi's WAF blocks Cloudflare Workers egress IPs (403), so production uses a stdlib-Python relay (`scripts/llm_relay.py`, deployed on the Aliyun server) that holds the real key and forwards streaming SSE; Workers point `KIMI_BASE_URL` at it and send `KIMI_RELAY_SECRET` as `X-Relay-Secret`. Assistant answers are Markdown rendered with react-markdown; ` ```echarts ` fences render as client-side ECharts (CDN-loaded). The chat DB schema lives in `scripts/chat-migration.sql` and must be run manually in Supabase. `/chat` and `/api/chat/*` are gated by `middleware.ts` (HMAC-signed httpOnly cookie, 7-day expiry; login page `/chat/login`); credentials live in `ai.config.json` → `auth.users` as SHA-256 hex hashes (`lib/chat-auth.ts`).

**Path alias:** `@/*` maps to the repo root (e.g. `@/lib/supabase`).

**Local build caveat:** `C:\Users\lhy0542\bin\npm` is a broken shim (points to a deleted kimi-desktop node.exe) — it shadows the real npm in Git Bash and breaks `npm`/`npx` and `pages:build` (next-on-pages can't spawn npx on Windows anyway). Use `C:\Program Files\nodejs\npm.cmd` for installs/builds; deployment builds happen on Cloudflare's infrastructure via Git integration. Plain `next build` on this machine fails with `spawn UNKNOWN` (errno -4094, Windows libuv worker-spawn bug) — `next.config.mjs` sets `experimental.cpus: 1` as the workaround; keep it.

**Docs:** `docs/TECHNICAL_ANALYSIS.md` (2026-07-14) records the original design rationale (credential isolation, edge runtime, env fallback). It predates the sidebar/multi-page/server-paginated architecture — read it for the "why", not for current structure.
