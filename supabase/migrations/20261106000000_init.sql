-- SmartPurchasing AI: core schema.
-- Access model: the Next.js server talks to PostgREST with the publishable key plus an
-- `x-app-key` header. Row Level Security admits a request only when that header matches the
-- secret stored in private.app_secrets, so the publishable key alone grants nothing.

create schema if not exists private;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null
);
revoke all on schema private from anon, authenticated;

create or replace function public.app_is_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.app_secrets s
    where s.key = 'db_key'
      and s.value = coalesce((current_setting('request.headers', true))::json ->> 'x-app-key', '')
  );
$$;
revoke all on function public.app_is_authorized() from public;
grant execute on function public.app_is_authorized() to anon, authenticated;

create table public.vendors (
  id text primary key,
  name text not null,
  short_name text not null,
  type text not null,
  terms text not null default '',
  ordering_method text not null default '',
  fees jsonb not null default '[]'::jsonb,
  sales_tax_rate numeric not null default 0,
  taxable_categories text[] not null default '{}',
  color text not null default '#64748b',
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  name text not null,
  category text not null,
  pack_size text not null default '',
  base_unit text not null default 'case',
  par_level numeric not null default 0,
  on_hand numeric not null default 0,
  preferred_vendor_id text references public.vendors(id) on delete set null,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_products (
  product_id text not null references public.products(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete cascade,
  sku text not null default '',
  description text not null default '',
  pack_size text not null default '',
  price numeric not null,
  price_unit text not null,
  last_invoice_date date,
  source text not null default 'invoice',
  updated_at timestamptz not null default now(),
  primary key (product_id, vendor_id)
);

create table public.price_history (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete cascade,
  price numeric not null,
  price_unit text not null,
  date date not null,
  invoice_id text,
  previous_price numeric,
  created_at timestamptz not null default now()
);
create index price_history_product_vendor_date_idx on public.price_history (product_id, vendor_id, date desc);

create table public.invoices (
  id text primary key,
  vendor_id text not null references public.vendors(id),
  invoice_number text not null,
  date date not null,
  pages integer not null default 1,
  status text not null,
  subtotal numeric not null default 0,
  fees numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  lines jsonb not null default '[]'::jsonb,
  source text not null default 'upload',
  extraction text not null default 'simulated',
  file_name text,
  uploaded_at timestamptz,
  approved_at timestamptz,
  confidence numeric,
  reject_reason text,
  notes text,
  updated_at timestamptz not null default now()
);
create index invoices_vendor_date_idx on public.invoices (vendor_id, date desc);

create table public.purchase_orders (
  id text primary key,
  number text not null,
  vendor_id text not null references public.vendors(id),
  created_at timestamptz not null,
  status text not null,
  lines jsonb not null default '[]'::jsonb,
  merchandise numeric not null default 0,
  fees numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  savings numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id text primary key,
  ts timestamptz not null,
  actor text not null,
  type text not null,
  summary text not null,
  details text,
  entity_type text,
  entity_id text
);
create index audit_log_ts_idx on public.audit_log (ts desc);

create table public.app_settings (
  id text primary key default 'default',
  restaurant_name text not null default 'SmartPurchasing AI',
  order_overrides jsonb not null default '{}'::jsonb,
  routing jsonb not null default '{"mode":"smart","singleVendorId":"cheney","lineOverrides":{}}'::jsonb,
  seeded_at timestamptz,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['vendors','products','vendor_products','price_history','invoices','purchase_orders','audit_log','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "app key access" on public.%I for all to anon, authenticated using (public.app_is_authorized()) with check (public.app_is_authorized())',
      t
    );
  end loop;
end $$;
