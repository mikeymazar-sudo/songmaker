"use client";

import { ArrowRight, Check, ClipboardCheck, FileText, TrendingDown, TrendingUp, Truck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AuditTypeBadge } from "@/components/audit/AuditTypeBadge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import { VendorDot } from "@/components/ui/VendorBadge";
import { cn, daysAgoISO, fmtNum, fmtShortDate, money, moneyWhole, relativeTime, round2, unitLabel } from "@/lib/format";
import { routeOrder, suggestedQty } from "@/lib/pricing";
import { useApp } from "@/lib/store";

function greeting(): { hello: string; date: string } {
  const now = new Date();
  const h = now.getHours();
  return {
    hello: h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening",
    date: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
  };
}

export function DashboardPage() {
  const { state } = useApp();
  const routing = useMemo(() => routeOrder(state), [state]);
  const since = daysAgoISO(30);
  const { hello, date } = greeting();

  const data = useMemo(() => {
    const approved = state.invoices.filter((i) => i.status === "approved");
    const recent = approved.filter((i) => i.date >= since);
    const spend = round2(recent.reduce((s, i) => s + i.total, 0));
    const fees = round2(recent.reduce((s, i) => s + i.fees + i.tax, 0));
    const byVendor = state.vendors
      .map((v) => ({
        vendor: v,
        total: round2(recent.filter((i) => i.vendorId === v.id).reduce((s, i) => s + i.total, 0)),
        count: recent.filter((i) => i.vendorId === v.id).length,
      }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
    const pending = state.invoices.filter((i) => i.status === "needs-review" || i.status === "processing");
    const active = state.products.filter((p) => !p.archived);
    const belowPar = active.filter((p) => suggestedQty(p) > 0);
    const priceChanges = state.priceHistory
      .filter((h) => h.previousPrice !== undefined && Math.abs(h.price - h.previousPrice) / h.previousPrice > 0.005)
      .slice(0, 6);
    const lastCount = state.audit.find((e) => e.type === "inventory");
    return { recent, spend, fees, byVendor, pending, active, belowPar, priceChanges, lastCount };
  }, [state, since]);

  const vendorOf = (id: string) => state.vendors.find((v) => v.id === id);
  const maxSpend = Math.max(1, ...data.byVendor.map((v) => v.total));
  const approvedThisWeek = state.purchaseOrders.length > 0;

  return (
    <>
      <div className="mb-7">
        <p className="text-sm font-medium text-muted">{date}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-text sm:text-[32px]">{hello}</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-text-2">
          {data.belowPar.length === 0
            ? "Everything is stocked to par. Nice."
            : `${data.belowPar.length} of ${data.active.length} items are below par. Your order is ready to review: ${money(routing.total)} from ${routing.vendorsActive} vendor${routing.vendorsActive === 1 ? "" : "s"}.`}
        </p>
      </div>

      {/* The weekly routine, in order */}
      <section aria-labelledby="this-week" className="mb-6">
        <h2 id="this-week" className="sr-only">
          This week
        </h2>
        <ol className="grid gap-3 lg:grid-cols-3">
          <Step
            n={1}
            icon={ClipboardCheck}
            title="Count your stock"
            text={
              data.lastCount
                ? `Last count ${relativeTime(data.lastCount.ts)}. Walk the cooler, freezer and shelves and tap + or −.`
                : "Walk the cooler, freezer and shelves and tap + or − to match what you see."
            }
            href="/order"
            cta="Start counting"
            done={false}
            primary
          />
          <Step
            n={2}
            icon={Truck}
            title="Approve this week's order"
            text={
              routing.carts.length === 0
                ? "Nothing to order. Everything is at par."
                : `${money(routing.total)} from ${routing.vendorsActive} vendor${routing.vendorsActive === 1 ? "" : "s"}. We picked the cheapest vendor for each item, so you save ${money(routing.savings)}.`
            }
            href="/orders"
            cta="Review the order"
            done={routing.carts.length === 0 && approvedThisWeek}
          />
          <Step
            n={3}
            icon={FileText}
            title="Check in your invoices"
            text={
              data.pending.length > 0
                ? `${data.pending.length} invoice${data.pending.length === 1 ? " is" : "s are"} waiting for you to check.`
                : "When a delivery arrives, snap a photo of the invoice. Prices update when you approve it."
            }
            href="/invoices"
            cta={data.pending.length > 0 ? "Check invoices" : "Add an invoice"}
            done={false}
            alert={data.pending.length > 0}
          />
        </ol>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="This week's order"
          value={money(routing.total)}
          hint={`${fmtNum(routing.units)} units · ${routing.vendorsActive} vendors`}
        />
        <KpiTile
          label="You save"
          value={money(routing.savings)}
          tone="success"
          hint={`vs. the priciest vendor · about ${moneyWhole(routing.savings * 52)} a year`}
        />
        <KpiTile
          label="Spent, last 30 days"
          value={money(data.spend)}
          hint={`${data.recent.length} invoices, incl. ${money(data.fees)} fees & tax`}
        />
        <KpiTile
          label="Invoices to check"
          value={data.pending.length}
          tone={data.pending.length > 0 ? "warning" : "default"}
          hint={data.pending.length > 0 ? "Waiting for your OK" : "All caught up"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="This week's order, by vendor"
              subtitle="Cheapest vendor for each item, including delivery fees and tax"
              action={
                routing.carts.length > 0 ? (
                  <Link href="/orders" className="text-sm font-medium text-accent hover:underline">
                    Open order
                  </Link>
                ) : undefined
              }
            />
            <CardBody>
              {routing.carts.length === 0 ? (
                <p className="text-[15px] text-muted">Everything is at par. Count your stock to build an order.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {routing.carts.map((c) => (
                    <li key={c.vendor.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <VendorDot vendor={c.vendor} className="h-3 w-3" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium text-text">{c.vendor.name}</div>
                        <div className="text-[13px] text-muted">
                          {c.lines.length} items · {fmtNum(c.units)} units · order via {c.vendor.orderingMethod}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular text-[15px] font-semibold text-text">{money(c.total)}</div>
                        {c.savings > 0 ? <div className="tabular text-[13px] text-success">saves {money(c.savings)}</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {routing.missingQuotes.length > 0 ? (
                <p className="mt-4 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
                  {routing.missingQuotes.length} item{routing.missingQuotes.length === 1 ? " is" : "s are"} below par but no vendor has a
                  price for {routing.missingQuotes.length === 1 ? "it" : "them"} yet.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Where your money went" subtitle="Approved invoices from the last 30 days, including fees and tax" />
            <CardBody>
              {data.byVendor.length === 0 ? (
                <EmptyState title="No approved invoices yet" description="Approve an invoice and your spending shows up here." />
              ) : (
                <ul className="space-y-3">
                  {data.byVendor.map((d) => (
                    <li
                      key={d.vendor.id}
                      className="grid grid-cols-[7rem_minmax(0,1fr)_6.5rem] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_7rem]"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[15px] text-text-2">
                        <VendorDot vendor={d.vendor} />
                        <span className="truncate">{d.vendor.shortName}</span>
                      </span>
                      <span className="relative block h-7" title={`${d.count} invoice${d.count === 1 ? "" : "s"}`}>
                        <span
                          className="absolute inset-y-[9px] left-0 rounded-r-[4px]"
                          style={{ width: `${Math.max(2, (d.total / maxSpend) * 100)}%`, backgroundColor: d.vendor.color }}
                        />
                      </span>
                      <span className="text-right">
                        <span className="tabular block text-[15px] font-medium text-text">{money(d.total)}</span>
                        <span className="block text-[12px] text-muted">
                          {d.count} invoice{d.count === 1 ? "" : "s"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Prices that changed" subtitle="From your latest invoices" />
            <CardBody>
              {data.priceChanges.length === 0 ? (
                <p className="text-sm text-muted">No price changes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.priceChanges.map((h) => {
                    const product = state.products.find((p) => p.id === h.productId);
                    const vendor = vendorOf(h.vendorId);
                    const delta = (h.price - (h.previousPrice ?? h.price)) / (h.previousPrice ?? 1);
                    const up = delta > 0;
                    return (
                      <li key={h.id} className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            up ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
                          )}
                        >
                          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-medium text-text">{product?.name ?? h.productId}</div>
                          <div className="text-[13px] text-muted">
                            {vendor?.shortName} · {money(h.previousPrice ?? 0)} → {money(h.price)} per {unitLabel(h.priceUnit)} ·{" "}
                            {fmtShortDate(h.date)}
                          </div>
                        </div>
                        <span className={cn("tabular shrink-0 text-sm font-semibold", up ? "text-danger" : "text-success")}>
                          {up ? "Up" : "Down"} {Math.abs(delta * 100).toFixed(0)}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent activity"
              action={
                <Link href="/audit" className="text-sm font-medium text-accent hover:underline">
                  See all
                </Link>
              }
            />
            <CardBody>
              <ul className="space-y-3">
                {state.audit.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5">
                    <AuditTypeBadge type={e.type} />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm text-text">{e.summary}</div>
                      <div className="text-[13px] text-muted">{relativeTime(e.ts)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  text,
  href,
  cta,
  done,
  primary,
  alert,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  text: string;
  href: string;
  cta: string;
  done: boolean;
  primary?: boolean;
  alert?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "group flex h-full flex-col rounded-(--radius-card) border bg-surface p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          alert ? "border-warning/50" : "border-border",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              done ? "bg-success-soft text-success" : "bg-brand text-brand-fg",
            )}
            aria-hidden
          >
            {done ? <Check className="h-4 w-4" /> : n}
          </span>
          <h3 className="flex-1 text-[17px] font-semibold tracking-tight text-text">{title}</h3>
          <Icon className="h-5 w-5 text-muted" aria-hidden />
        </div>
        <p className="mt-3 flex-1 text-[15px] leading-relaxed text-text-2">{text}</p>
        <span
          className={cn(
            "mt-4 inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl px-4 text-[15px] font-medium transition-colors",
            primary || alert
              ? "bg-brand text-brand-fg group-hover:bg-brand-hover"
              : "border border-border-strong bg-surface text-text group-hover:bg-surface-2",
          )}
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}
