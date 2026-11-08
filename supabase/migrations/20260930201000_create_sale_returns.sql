create table if not exists public.uptrend_sale_returns (
  id uuid primary key default gen_random_uuid(),

  sale_id uuid not null
    references public.sales(id)
    on delete restrict,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  quantity integer not null
    check (quantity > 0),

  refund_amount numeric(18,2) not null
    check (refund_amount > 0),

  refund_method text not null
    check (refund_method in ('cash', 'transfer')),

  refund_finance_transaction_id uuid
    references public.uptrend_finance_transactions(id)
    on delete set null,

  reason text,

  return_date date not null
    default current_date,

  created_at timestamptz not null
    default now()
);

create index if not exists
  uptrend_sale_returns_sale_id_idx
on public.uptrend_sale_returns (sale_id);

create index if not exists
  uptrend_sale_returns_user_id_idx
on public.uptrend_sale_returns (user_id);

create index if not exists
  uptrend_sale_returns_refund_transaction_idx
on public.uptrend_sale_returns (refund_finance_transaction_id);

alter table public.uptrend_sale_returns enable row level security;

drop policy if exists
  "Users can view their own sale returns"
on public.uptrend_sale_returns;

create policy
  "Users can view their own sale returns"
on public.uptrend_sale_returns
for select
using (auth.uid() = user_id);
