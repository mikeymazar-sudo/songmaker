"use client";

import { ClipboardCheck, ScanLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useInvoiceCapture } from "@/components/invoices/InvoiceCapture";
import { buttonStyles } from "@/components/ui/Button";
import { Hero } from "@/components/ui/Hero";
import { List, Row, Section } from "@/components/ui/List";
import { Panel } from "@/components/ui/Panel";
import { cn, daysAgoISO, fmtNum, money, moneyWhole, relativeTime, round2 } from "@/lib/format";
import { routeOrder, suggestedQty } from "@/lib/pricing";
import { useApp } from "@/lib/store";

export function DashboardPage() {
  const { state, setUi } = useApp();
  const router = useRouter();
  const capture = useInvoiceCapture({
    onCreated: (invoice) => {
      setUi({ selectedInvoiceId: invoice.id, nonce: Date.now() });
      router.push("/invoices");
    },
  });
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
    const belowPar = state.products.filter((p) => !p.archived && suggestedQty(p) > 0);
    const priceChanges = state.priceHistory
      .filter((h) => h.previousPrice !== undefined && Math.abs(h.price - h.previousPrice) / h.previousPrice > 0.005)
      .slice(0, 5);
    const lastCount = state.audit.find((e) => e.type === "inventory");
    return { spend, byVendor, pending, belowPar, priceChanges, lastCount };
  }, [state, since]);

  const maxSpend = Math.max(1, ...data.byVendor.map((v) => v.total));
  const hasOrder = routing.carts.length > 0;

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-16">
      {capture.mount}
      <div>
        <p className="mb-4 text-[15px] text-muted">{today}</p>
        <Panel>
          <Hero
            label="This week's order"
            value={moneyWhole(routing.total)}
            hint={
              hasOrder ? (
                <>
                  {fmtNum(routing.units)} unit{routing.units === 1 ? "" : "s"} from {routing.vendorsActive} vendor{routing.vendorsActive === 1 ? "" : "s"}
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
          <Link href={hasOrder ? "/orders" : "/order"} className={buttonStyles("primary", "md", "mt-5 w-full")}>
            {hasOrder ? "Review order" : "Start count"}
          </Link>
        </Panel>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Tile
            href="/order"
            icon={ClipboardCheck}
            title="Count stock"
            hint={data.lastCount ? `Last count ${relativeTime(data.lastCount.ts)}` : `${data.belowPar.length} below par`}
          />
          <Tile onClick={capture.scan} icon={ScanLine} title="Scan invoice" hint={capture.canRead ? "Read twice and checked" : "Photo reading is off"} />
        </div>

        {data.pending.length > 0 || routing.missingQuotes.length > 0 ? (
          <Section title="Waiting on you" className="mt-8">
            <List>
              {data.pending.length > 0 ? (
                <li>
                  <Row
                    href="/invoices"
                    title={`${data.pending.length} invoice${data.pending.length === 1 ? "" : "s"} to check`}
                    subtitle="Prices update when you approve"
                  />
                </li>
              ) : null}
              {routing.missingQuotes.length > 0 ? (
                <li>
                  <Row
                    href="/orders"
                    title={`${routing.missingQuotes.length} item${routing.missingQuotes.length === 1 ? " needs" : "s need"} a price`}
                    subtitle="Below par, but no vendor has a price yet"
                  />
                </li>
              ) : null}
            </List>
          </Section>
        ) : null}

        {hasOrder ? (
          <Section title="Order by vendor" className="mt-8">
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
          <Section title="Prices that changed" className="mt-8 lg:mt-0">
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

        <Section
          title="Last 30 days"
          action={<span className="tabular text-text">{money(data.spend)}</span>}
          className={cn("mt-8", data.priceChanges.length === 0 && "lg:mt-0")}
        >
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

/** A big, labelled shortcut to one of the two jobs done standing up: counting and scanning. */
function Tile({ href, onClick, icon: Icon, title, hint }: { href?: string; onClick?: () => void; icon: LucideIcon; title: string; hint: string }) {
  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3 text-text">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="mt-3 block text-[15px] font-semibold text-text">{title}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-muted">{hint}</span>
    </>
  );
  const shared = "block rounded-2xl border border-border p-4 text-left transition-colors active:bg-surface-2 md:hover:bg-surface-2";
  return href ? (
    <Link href={href} className={shared}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={shared}>
      {body}
    </button>
  );
}
