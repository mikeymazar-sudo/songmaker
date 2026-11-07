"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TakeInvoicePhoto } from "@/components/invoices/TakeInvoicePhoto";
import { buttonStyles } from "@/components/ui/Button";
import { Hero } from "@/components/ui/Hero";
import { List, Row, Section } from "@/components/ui/List";
import { cn, daysAgoISO, fmtNum, money, moneyWhole, relativeTime, round2 } from "@/lib/format";
import { routeOrder, suggestedQty } from "@/lib/pricing";
import { useApp } from "@/lib/store";

export function DashboardPage() {
  const { state } = useApp();
  const routing = useMemo(() => routeOrder(state), [state]);
  const since = daysAgoISO(30);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const data = useMemo(() => {
    const recent = state.invoices.filter((i) => i.status === "approved" && i.date >= since);
    const spend = round2(recent.reduce((s, i) => s + i.total, 0));
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
      .slice(0, 5);
    const lastCount = state.audit.find((e) => e.type === "inventory");
    return { recent, spend, byVendor, pending, belowPar, priceChanges, lastCount };
  }, [state, since]);

  const maxSpend = Math.max(1, ...data.byVendor.map((v) => v.total));
  const hasOrder = routing.carts.length > 0;

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-20">
      <div>
        <p className="mb-6 text-[15px] text-muted">{today}</p>
        <Hero
          label="This week's order"
          value={moneyWhole(routing.total)}
          hint={
            hasOrder ? (
              <>
                {fmtNum(routing.units)} units from {routing.vendorsActive} vendor{routing.vendorsActive === 1 ? "" : "s"}
                {routing.savings > 0 ? (
                  <>
                    {" · "}
                    <span className="font-medium text-success">saves {moneyWhole(routing.savings)}</span>
                  </>
                ) : null}
              </>
            ) : (
              "Everything is stocked to par."
            )
          }
        />
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Link href="/order" className={buttonStyles("primary", "md", "w-full")}>
            Start count
          </Link>
          <Link href="/orders" className={buttonStyles("outline", "md", "w-full")}>
            Review order
          </Link>
          <TakeInvoicePhoto className="col-span-2 w-full" />
        </div>

        <List className="mt-6 border-y border-border">
          <li>
            <Row
              href="/invoices"
              title={data.pending.length > 0 ? `${data.pending.length} invoice${data.pending.length === 1 ? "" : "s"} to check` : "All invoices"}
              subtitle={data.pending.length > 0 ? "Waiting for your OK" : "Upload a file or find an old one"}
            />
          </li>
          {routing.missingQuotes.length > 0 ? (
            <li>
              <Row
                href="/orders"
                title={`${routing.missingQuotes.length} item${routing.missingQuotes.length === 1 ? " needs" : "s need"} a price`}
                subtitle="Below par, but no vendor has a price yet"
              />
            </li>
          ) : null}
          {data.belowPar.length > 0 ? (
            <li>
              <Row
                href="/order"
                title={`${data.belowPar.length} item${data.belowPar.length === 1 ? "" : "s"} below par`}
                subtitle={data.lastCount ? `Last counted ${relativeTime(data.lastCount.ts)}` : "Not counted yet"}
              />
            </li>
          ) : null}
        </List>

        {hasOrder ? (
          <Section title="Order by vendor">
            <List>
              {routing.carts.map((c) => (
                <li key={c.vendor.id}>
                  <Row
                    href="/orders"
                    title={c.vendor.name}
                    subtitle={`${c.lines.length} item${c.lines.length === 1 ? "" : "s"}`}
                    value={money(c.total)}
                  />
                </li>
              ))}
            </List>
          </Section>
        ) : null}
      </div>

      <div>
        {data.priceChanges.length > 0 ? (
          <Section title="Prices that changed" className="lg:mt-0">
            <List>
              {data.priceChanges.map((h) => {
                const product = state.products.find((p) => p.id === h.productId);
                const vendor = state.vendors.find((v) => v.id === h.vendorId);
                const delta = (h.price - (h.previousPrice ?? h.price)) / (h.previousPrice ?? 1);
                const up = delta > 0;
                return (
                  <li key={h.id}>
                    <Row
                      title={product?.name ?? h.productId}
                      subtitle={`${vendor?.shortName} · ${money(h.previousPrice ?? 0)} to ${money(h.price)}`}
                      value={
                        <span className={up ? "text-danger" : "text-success"}>
                          {up ? "+" : "−"}
                          {Math.abs(delta * 100).toFixed(0)}%
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </List>
          </Section>
        ) : null}

        <Section title="Last 30 days" action={<span className="tabular text-text">{money(data.spend)}</span>} className={cn(data.priceChanges.length === 0 && "lg:mt-0")}>
          {data.byVendor.length === 0 ? (
            <p className="py-4 text-[15px] text-muted">Approve an invoice and your spending shows up here.</p>
          ) : (
            <List>
              {data.byVendor.map((d) => (
                <li key={d.vendor.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-medium text-text">{d.vendor.name}</span>
                    <span className="tabular text-[15px] font-medium text-text">{money(d.total)}</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" title={`${d.count} invoice${d.count === 1 ? "" : "s"}`}>
                    <div className="h-full rounded-full bg-text" style={{ width: `${Math.max(2, (d.total / maxSpend) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </List>
          )}
          <Link href="/graphs" className={buttonStyles("outline", "md", "mt-4 w-full")}>
            See graphs
          </Link>
        </Section>
      </div>
    </div>
  );
}
