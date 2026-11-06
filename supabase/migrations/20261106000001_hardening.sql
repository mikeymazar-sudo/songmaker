-- Hardening: transactional reset, audit rows are append-only, policies evaluate the auth check once per query.

create or replace function public.app_reset_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.app_is_authorized() then
    raise exception 'unauthorized';
  end if;
  truncate table
    public.audit_log,
    public.purchase_orders,
    public.invoices,
    public.price_history,
    public.vendor_products,
    public.products,
    public.vendors,
    public.app_settings;
end;
$$;
revoke all on function public.app_reset_all() from public;
grant execute on function public.app_reset_all() to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['vendors','products','vendor_products','price_history','invoices','purchase_orders','app_settings'] loop
    execute format('drop policy if exists "app key access" on public.%I', t);
    execute format(
      'create policy "app key access" on public.%I for all to anon, authenticated using ((select public.app_is_authorized())) with check ((select public.app_is_authorized()))',
      t
    );
  end loop;
end $$;

drop policy if exists "app key access" on public.audit_log;
create policy "audit read" on public.audit_log for select to anon, authenticated using ((select public.app_is_authorized()));
create policy "audit insert" on public.audit_log for insert to anon, authenticated with check ((select public.app_is_authorized()));
create policy "audit update" on public.audit_log for update to anon, authenticated using ((select public.app_is_authorized())) with check ((select public.app_is_authorized()));
