-- What the app did to check its own reading of an invoice: the total printed on the paper and the
-- outcome of the second, separate read. Per-line verdicts live inside invoices.lines.
alter table public.invoices add column if not exists verification jsonb;
