"use client";

import { ArrowRight, ClipboardList, FileText, TrendingDown, TrendingUp, Truck, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AuditTypeBadge } from "@/components/audit/AuditTypeBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { VendorBadge } from "@/components/ui/VendorBadge";
import { daysAgoISO, fmtDate, fmtNum, money, relativeTime, round2, signedPct, unitLabel } from "@/lib/format";
import { routeOrder, suggestedQty } from "@/lib/pricing";
import { useApp } from "@/lib/store";

export function DashboardPage() {
  const { state } = useApp();
  const routing = useMemo(() => routeOrder(state), [state]);
  const since = daysAgoISO(30);

  const data = useMemo(() => {
    const approved = state.invoices.filter((i) => i.status === "approved");
    const recent = approved.filter((i) => i.date >= since);
    const spend = round2(recent.reduce((s, i) => s + i.total, 0));
    const fees = round2(recent.reduce((s, i) => s + i.fees + i.tax, 0));
    const byVendor = state.vendors
      .map((v) => ({
        id: v.id,
        name: v.shortName,
        color: v.color,
        total: round2(recent.filter((i) => i.vendorId === v.id).reduce((s, i) => s + i.total, 0)),
        count: recent.filter((i) => i.vendorId === v.id).length,
      }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
    const pending = state.invoices.filter((i) => i.status === "needs-review");
    const belowPar = state.products.filter((p) => !p.archived && suggestedQty(p) > 0);
    const priceChanges = state.priceHistory
      .filter((h) => h.previousPrice !== undefined && Math.abs(h.price - h.previousPrice) / h.previousPrice > 0.005)
      .slice(0, 8);
    return { approved, recent, spend, fees, byVendor, pending, belowPar, priceChanges };
  }, [state, since]);

  const vendorOf = (id: string) => state.vendors.find((v) => v.id === id);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Where the money went in the last 30 days, what needs your attention, and what this week's order looks like."
        actions={
          <>
            <Link href="/invoices">
              <Button variant="outline" icon={<Upload className="h-4 w-4" />}>
                Upload invoice
              </Button>
            </Link>
            <Link href="/order">
              <Button icon={<ClipboardList className="h-4 w-4" />}>Start walk-in count</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Spend · 30 days" value={money(data.spend)} hint={`${data.recent.length} invoices · ${money(data.fees)} fees & tax`} />
        <KpiTile label="Awaiting review" value={data.pending.length} tone={data.pending.length > 0 ? "warning" : "default"} hint={data.pending.length > 0 ? "Invoices with AI extractions to verify" : "Inbox is clear"} />
        <KpiTile label="Items below par" value={data.belowPar.length} hint={`of ${state.products.filter((p) => !p.archived).length} active products`} />
        <KpiTile label="Suggested order" value={money(routing.total)} hint={`${fmtNum(routing.units)} units across ${routing.vendorsActive} vendors`} tone="brand" />
        <KpiTile label="Routing savings" value={money(routing.savings)} tone="success" hint={`${money(round2(routing.savings * 52))}/yr at this pace`} />
        <KpiTile label="Approved POs" value={state.purchaseOrders.length} hint={state.purchaseOrders.length > 0 ? `Latest ${relativeTime(state.purchaseOrders[0].createdAt)}` : "None yet"} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Spend by vendor" subtitle="Approved invoices in the last 30 days, including fees and tax" />
          <CardBody>
            {data.byVendor.length === 0 ? (
              <EmptyState title="No approved invoices yet" description="Upload and approve an invoice to see spend here." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byVendor} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={14}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--surface-3)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0].payload as (typeof data.byVendor)[number];
                        return (
                          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-lg">
                            <div className="font-semibold text-text">{d.name}</div>
                            <div className="text-muted">
                              {money(d.total)} · {d.count} invoice{d.count === 1 ? "" : "s"}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                      {data.byVendor.map((d) => (
                        <Cell key={d.id} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="This week's order"
            subtitle="Lowest landed cost per item"
            action={
              <Link href="/orders" className="text-sm font-medium text-accent hover:underline">
                Review
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {routing.carts.length === 0 ? (
              <p className="text-sm text-muted">Everything is at par. Start a walk-in count to build an order.</p>
            ) : (
              routing.carts.map((c) => (
                <div key={c.vendor.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <VendorBadge vendor={c.vendor} tone="plain" />
                    <span className="text-xs text-muted">{fmtNum(c.units)} units</span>
                  </div>
                  <div className="text-right">
                    <div className="tabular text-sm font-semibold text-text">{money(c.total)}</div>
                    {c.savings > 0 ? <div className="text-[11px] text-success">saves {money(c.savings)}</div> : null}
                  </div>
                </div>
              ))
            )}
            {routing.missingQuotes.length > 0 ? (
              <p className="text-xs text-warning">
                {routing.missingQuotes.length} item{routing.missingQuotes.length === 1 ? "" : "s"} below par with no vendor price.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Price changes" subtitle="From approved invoices" />
          <CardBody className="space-y-2">
            {data.priceChanges.length === 0 ? (
              <p className="text-sm text-muted">No price changes recorded yet.</p>
            ) : (
              data.priceChanges.map((h) => {
                const product = state.products.find((p) => p.id === h.productId);
                const vendor = vendorOf(h.vendorId);
                const delta = (h.price - (h.previousPrice ?? h.price)) / (h.previousPrice ?? 1);
                const up = delta > 0;
                return (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <span className={up ? "text-danger" : "text-success"}>{up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text">{product?.name ?? h.productId}</div>
                      <div className="text-xs text-muted">
                        {vendor?.shortName} · {money(h.previousPrice ?? 0)} → {money(h.price)}/{unitLabel(h.priceUnit)} · {fmtDate(h.date)}
                      </div>
                    </div>
                    <Badge tone={up ? "danger" : "success"}>{signedPct(delta)}</Badge>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Needs review"
            subtitle="AI-extracted invoices waiting for approval"
            action={
              <Link href="/invoices" className="text-sm font-medium text-accent hover:underline">
                Open
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {data.pending.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-7 w-7" />}
                title="Nothing to review"
                description="Upload a photo or PDF of an invoice and the extraction will land here."
                className="py-6"
              />
            ) : (
              data.pending.map((i) => {
                const vendor = vendorOf(i.vendorId);
                const flags = i.lines.reduce((s, l) => s + l.flags.length, 0);
                return (
                  <Link key={i.id} href="/invoices" className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 hover:bg-surface-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text">
                        {vendor?.name} · #{i.invoiceNumber}
                      </div>
                      <div className="text-xs text-muted">
                        {fmtDate(i.date)} · {i.lines.filter((l) => !l.isFee).length} lines · {flags} flag{flags === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="tabular text-sm font-semibold">{money(i.total)}</div>
                  </Link>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link href="/audit" className="text-sm font-medium text-accent hover:underline">
                Full log
              </Link>
            }
          />
          <CardBody className="space-y-2.5">
            {state.audit.slice(0, 7).map((e) => (
              <div key={e.id} className="flex items-start gap-2.5">
                <AuditTypeBadge type={e.type} />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm text-text">{e.summary}</div>
                  <div className="text-xs text-muted">{relativeTime(e.ts)}</div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/order" className="group flex items-center justify-between rounded-(--radius-card) border border-border bg-surface px-5 py-4 hover:bg-surface-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand dark:text-text">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-text">Walk the cooler</div>
              <div className="text-sm text-muted">Tap + / − on each item; the order builds itself.</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/orders" className="group flex items-center justify-between rounded-(--radius-card) border border-border bg-surface px-5 py-4 hover:bg-surface-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand dark:text-text">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-text">Vendor recommendations</div>
              <div className="text-sm text-muted">See who to order from this week and approve purchase orders.</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </>
  );
}
