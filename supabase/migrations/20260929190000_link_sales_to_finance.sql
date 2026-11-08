begin;

create or replace function public.record_sales_batch_with_finance(
  p_sales jsonb
)
returns setof public.sales
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_account_id uuid;
  v_item jsonb;
  v_sale public.sales;
  v_transaction public.uptrend_finance_transactions;

  v_product public.products;

  v_product_id uuid;
  v_product_name text;
  v_quantity integer;
  v_cost_price numeric;
  v_selling_price numeric;
  v_sale_date date;

  v_payment_method text;
  v_finance_transaction_id uuid;

  v_total_selling numeric;
  v_gross_profit numeric;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if p_sales is null
     or jsonb_typeof(p_sales) <> 'array'
     or jsonb_array_length(p_sales) = 0 then
    raise exception 'No sales were supplied.';
  end if;

  /*
   * Every user has one NGN finance account.
   */
  select id
  into v_account_id
  from public.uptrend_finance_accounts
  where user_id = v_user_id
    and currency = 'NGN'
  for update;

  if v_account_id is null then
    insert into public.uptrend_finance_accounts (
      user_id,
      currency,
      opening_balance
    )
    values (
      v_user_id,
      'NGN',
      0
    )
    returning id into v_account_id;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_sales)
  loop

    v_product_id :=
      (v_item->>'product_id')::uuid;

    v_product_name :=
      v_item->>'product_name';

    v_quantity :=
      (v_item->>'quantity')::integer;

    v_cost_price :=
      (v_item->>'cost_price')::numeric;

    v_selling_price :=
      (v_item->>'selling_price')::numeric;

    v_sale_date :=
      coalesce(
        (v_item->>'sale_date')::date,
        current_date
      );

    v_payment_method :=
      lower(trim(v_item->>'payment_method'));

    v_finance_transaction_id :=
      nullif(
        v_item->>'finance_transaction_id',
        ''
      )::uuid;

    if v_payment_method not in ('cash', 'transfer') then
      raise exception
        'Payment method must be Cash or Transfer.';
    end if;

    if v_quantity <= 0 then
      raise exception
        'Quantity must be greater than zero.';
    end if;

    if v_selling_price < 0 then
      raise exception
        'Selling price cannot be negative.';
    end if;

    /*
     * Lock product and validate stock.
     */
    select *
    into v_product
    from public.products
    where id = v_product_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'Product not found.';
    end if;

    if v_product.stock < v_quantity then
      raise exception
        'Insufficient stock for %. Available: %, required: %.',
        v_product.name,
        v_product.stock,
        v_quantity;
    end if;

    v_total_selling :=
      v_selling_price;

    v_gross_profit :=
      v_total_selling -
      (v_cost_price * v_quantity);

    /*
     * TRANSFER:
     *
     * The money already exists in the financial
     * ledger. We only link the sale to it.
     */
    if v_payment_method = 'transfer' then

      if v_finance_transaction_id is null then
        raise exception
          'Select the transfer transaction for this sale.';
      end if;

      select *
      into v_transaction
      from public.uptrend_finance_transactions
      where id = v_finance_transaction_id
        and user_id = v_user_id
        and account_id = v_account_id
      for update;

      if not found then
        raise exception
          'The selected transfer transaction was not found.';
      end if;

      if v_transaction.type <> 'credit' then
        raise exception
          'The selected transaction is not money received.';
      end if;

      if v_transaction.status <> 'completed' then
        raise exception
          'Only completed transfers can be linked to a sale.';
      end if;

      if v_transaction.amount <> v_total_selling then
        raise exception
          'Transfer amount ₦% does not match sale amount ₦%.',
          to_char(v_transaction.amount, 'FM999999999999990.00'),
          to_char(v_total_selling, 'FM999999999999990.00');
      end if;

      /*
       * A financial transaction can belong to
       * only one sale.
       */
      if exists (
        select 1
        from public.sales
        where finance_transaction_id =
          v_finance_transaction_id
      ) then
        raise exception
          'This transfer has already been linked to a sale.';
      end if;

    /*
     * CASH:
     *
     * Create the Money In transaction automatically.
     */
    else

      v_finance_transaction_id := null;

    end if;

    /*
     * Reduce inventory.
     */
    update public.products
    set
      stock = stock - v_quantity,
      updated_at = now()
    where id = v_product_id
      and user_id = v_user_id;

    /*
     * Create the sale first so the finance
     * transaction can reference the sale.
     */
    insert into public.sales (
      user_id,
      product_id,
      product_name,
      quantity,
      cost_price,
      selling_price,
      total_selling,
      gross_profit,
      sale_date,
      payment_method,
      finance_transaction_id
    )
    values (
      v_user_id,
      v_product_id,
      v_product_name,
      v_quantity,
      v_cost_price,
      v_selling_price,
      v_total_selling,
      v_gross_profit,
      v_sale_date,
      v_payment_method,
      v_finance_transaction_id
    )
    returning *
    into v_sale;

    /*
     * CASH creates the financial transaction
     * after the sale ID exists.
     */
    if v_payment_method = 'cash' then

      insert into public.uptrend_finance_transactions (
        user_id,
        account_id,
        type,
        amount,
        status,
        category,
        description,
        reference,
        metadata
      )
      values (
        v_user_id,
        v_account_id,
        'credit',
        v_total_selling,
        'completed',
        'Sales',
        'Cash sale - ' || v_product_name,
        'sale:' || v_sale.id,
        jsonb_build_object(
          'source', 'sale',
          'payment_method', 'cash',
          'sale_id', v_sale.id
        )
      )
      returning *
      into v_transaction;

      update public.sales
      set finance_transaction_id = v_transaction.id
      where id = v_sale.id
        and user_id = v_user_id;

      v_sale.finance_transaction_id :=
        v_transaction.id;

      insert into public.uptrend_finance_audit (
        user_id,
        transaction_id,
        action,
        details
      )
      values (
        v_user_id,
        v_transaction.id,
        'sale_cash_received',
        jsonb_build_object(
          'sale_id', v_sale.id,
          'amount', v_total_selling
        )
      );

    else

      /*
       * Mark the existing transfer as linked
       * in its metadata without changing its
       * financial amount.
       */
      update public.uptrend_finance_transactions
      set
        metadata =
          coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'linked_sale_id', v_sale.id,
            'linked_source', 'sale'
          ),
        updated_at = now()
      where id = v_finance_transaction_id
        and user_id = v_user_id;

    end if;

    return next v_sale;

  end loop;

  return;
end;
$function$;


grant execute on function public.record_sales_batch_with_finance(jsonb)
to authenticated;


commit;
