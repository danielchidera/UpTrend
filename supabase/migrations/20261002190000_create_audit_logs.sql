begin;

create table if not exists public.uptrend_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_email text,
  action text not null,
  category text not null default 'system',
  description text not null,
  entity_type text,
  entity_id text,
  amount numeric(18,2),
  currency text not null default 'NGN',
  status text not null default 'success'
    check (status in ('success', 'failed', 'cancelled', 'warning')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists uptrend_audit_logs_user_created_idx
  on public.uptrend_audit_logs (user_id, created_at desc);

create index if not exists uptrend_audit_logs_user_category_idx
  on public.uptrend_audit_logs (user_id, category);

alter table public.uptrend_audit_logs enable row level security;

drop policy if exists "Users can view their own audit logs"
  on public.uptrend_audit_logs;

create policy "Users can view their own audit logs"
  on public.uptrend_audit_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own audit logs"
  on public.uptrend_audit_logs;

create policy "Users can create their own audit logs"
  on public.uptrend_audit_logs
  for insert
  with check (auth.uid() = user_id);

commit;
