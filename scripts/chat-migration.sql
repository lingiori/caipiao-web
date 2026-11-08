-- =============================================================
-- AI 问答功能 - 数据库迁移脚本
-- 在 Supabase SQL 编辑器中执行一次。
-- 原则 1：本脚本只新增对象，不修改任何现有表结构与数据。
-- =============================================================

-- 1. 会话表：一个聊天窗口对应一行
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default '新对话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 消息表：assistant 的 content 为 Markdown 文本
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_session_created
  on public.chat_messages (session_id, created_at);
create index if not exists idx_chat_sessions_updated
  on public.chat_sessions (updated_at desc);

-- 3. 只读 SQL 执行函数（供 AI 智能体的 run_sql 工具调用）
--    防护：仅 SELECT/WITH、禁多语句、禁危险关键字、表名白名单、
--    5s 语句超时、外层强制 limit 200。
--    保持 SECURITY INVOKER（默认）：调用者 anon 角色本来就对
--    kl8_* 表只有 SELECT 权限，无提权风险。
--    ⚠️ 切勿改为 SECURITY DEFINER；如必须改，必须同时加
--       set search_path = public，否则存在 search_path 劫持风险。
create or replace function public.execute_readonly_sql(query text)
returns jsonb
language plpgsql
as $$
declare
  q text;
  result jsonb;
  tbl text;
  allowed text[] := array[
    'kl8_bingo_all', 'kl8_dimension_step',
    'kl8_dimension_step2', 'kl8_dimension_hit_history'
  ];
begin
  q := btrim(query);
  q := regexp_replace(q, ';\s*$', '');          -- 去掉末尾分号
  if q = '' then
    raise exception 'empty query';
  end if;
  if position(';' in q) > 0 then
    raise exception 'multiple statements are not allowed';
  end if;
  if q !~* '^\s*(select|with)\b' then
    raise exception 'only SELECT queries are allowed';
  end if;
  if q ~* '\m(insert|update|delete|drop|alter|truncate|grant|revoke|create|comment|copy|call|do|set|listen|unlisten|notify|vacuum|reindex|cluster|refresh|begin|commit|rollback|savepoint|lock|prepare|deallocate|execute|merge|security|import)\M' then
    raise exception 'forbidden keyword detected';
  end if;

  -- CTE 别名（with a as (...), b as (...)）加入白名单
  for tbl in
    select m[1] from regexp_matches(
      q, '(?i)(?:\mwith\M|,)\s*([a-zA-Z_]\w*)\s+as\s*\(', 'g') as m
  loop
    allowed := allowed || lower(tbl);
  end loop;

  -- FROM / JOIN 后的每个表名必须在白名单内
  for tbl in
    select m[1] from regexp_matches(
      q, '(?i)\m(?:from|join)\s+([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)?)', 'g') as m
  loop
    tbl := lower(regexp_replace(tbl, '^.*\.', ''));   -- 去掉 schema 前缀
    if not (tbl = any(allowed)) then
      raise exception 'table "%" is not allowed', tbl;
    end if;
  end loop;

  set local statement_timeout = '5s';
  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb)
       from (select * from (%s) _capped limit 200) t', q)
  into result;
  return result;
end $$;

revoke all on function public.execute_readonly_sql(text) from public;
grant execute on function public.execute_readonly_sql(text) to anon, authenticated;

-- =============================================================
-- 负面自测（执行后应全部报错）：
--   select public.execute_readonly_sql('delete from kl8_bingo_all');
--   select public.execute_readonly_sql('select * from pg_class');
--   select public.execute_readonly_sql('select 1; select 2');
-- 正面自测（应返回 jsonb 数组）：
--   select public.execute_readonly_sql('select issue from kl8_bingo_all order by issue desc limit 3');
-- =============================================================
