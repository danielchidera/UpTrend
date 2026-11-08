
-- ============================================================
-- UpTrend: Recurring Expenses
-- Business-only feature
-- ============================================================

create table if not exists public.uptrend_recurring_expenses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  category text not null default 'General',
  amount numeric(14,2) not null check (amount >= 0),
  note text not null default '',
  payment_method text not null default 'cash',

  frequency text not null
    check (frequency in ('weekly', 'monthly', 'yearly')),

  start_date date not null,
  next_due_date date not null,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
  uptrend_recurring_expenses_user_id_idx
on public.uptrend_recurring_expenses(user_id);

create index if not exists
  uptrend_recurring_expenses_due_idx
on public.uptrend_recurring_expenses(user_id, next_due_date);

alter table public.uptrend_recurring_expenses enable row level security;

drop policy if exists
  "Users can view their recurring expenses"
on public.uptrend_recurring_expenses;

create policy
  "Users can view their recurring expenses"
on public.uptrend_recurring_expenses
for select
using (auth.uid() = user_id);

drop policy if exists
  "Users can create their recurring expenses"
on public.uptrend_recurring_expenses;

create policy
  "Users can create their recurring expenses"
on public.uptrend_recurring_expenses
for insert
with check (auth.uid() = user_id);

drop policy if exists
  "Users can update their recurring expenses"
on public.uptrend_recurring_expenses;

create policy
  "Users can update their recurring expenses"
on public.uptrend_recurring_expenses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists
  "Users can delete their recurring expenses"
on public.uptrend_recurring_expenses;

create policy
  "Users can delete their recurring expenses"
on public.uptrend_recurring_expenses
for delete
using (auth.uid() = user_id);

create or replace function public.set_recurring_expense_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists
  recurring_expenses_updated_at
on public.uptrend_recurring_expenses;

create trigger
  recurring_expenses_updated_at
before update on public.uptrend_recurring_expenses
for each row
execute function public.set_recurring_expense_updated_at();
