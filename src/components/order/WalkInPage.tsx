"use client";

import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { KpiTile } from "@/components/ui/KpiTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { VendorBadge } from "@/components/ui/VendorBadge";
import { CATEGORIES } from "@/data/types";
import { cn, fmtNum, money, unitLabel } from "@/lib/format";
import type { CategoryFilter, ProductRecord, VendorQuote } from "@/lib/models";
import { bestQuote, getQuotes, isOverridden, orderQty, routeOrder, suggestedQty } from "@/lib/pricing";
import { useActions, useApp } from "@/lib/store";

export function WalkInPage() {
  const { state } = useApp();
  const actions = useActions();
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [query, setQuery] = useState("");
  const [onlyBelowPar, setOnlyBelowPar] = useState(false);

  const routing = useMemo(() => routeOrder(state), [state]);

  const active = useMemo(() => state.products.filter((p) => !p.archived), [state.products]);

  const belowParByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of active) if (suggestedQty(p) > 0) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, [active]);

  const visible = useMemo(() => {
    const t = query.trim().toLowerCase();
    return active
      .filter((p) => category === "All" || p.category === category)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.packSize.toLowerCase().includes(t))
      .filter((p) => !onlyBelowPar || orderQty(state, p) > 0)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [active, category, query, onlyBelowPar, state]);

  const categoriesInUse = CATEGORIES.filter((c) => active.some((p) => p.category === c));

  return (
    <>
      <PageHeader
        title="Walk-in Count & Order Builder"
        description="Walk the cooler, freezer and dry storage. Tap + / − on what's on hand; the order quantity is par minus on hand, and the winning vendor is picked on landed cost."
        actions={
          <Link href="/orders">
            <Button iconRight={<ArrowRight className="h-4 w-4" />}>Review vendor orders</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Units to order" value={fmtNum(routing.units)} hint={`${routing.lines.length} items below par`} />
        <KpiTile label="Best routed total" value={money(routing.total)} tone="brand" hint={`vs ${money(routing.unoptimized)} at highest quotes`} />
        <KpiTile label="Savings this order" value={money(routing.savings)} tone="success" hint="Lowest landed cost per item" />
        <KpiTile label="Vendors in order" value={routing.vendorsActive} hint={routing.carts.map((c) => c.vendor.shortName).join(" · ") || "—"} />
      </div>

      <div className="sticky top-16 z-20 -mx-4 mt-4 bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-1">
            <CategoryChip active={category === "All"} onClick={() => setCategory("All")} label="All" count={active.filter((p) => suggestedQty(p) > 0).length} />
            {categoriesInUse.map((c) => (
              <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)} label={c} count={belowParByCategory[c] ?? 0} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an item…" className="pl-9" />
            </div>
            <button
              type="button"
              onClick={() => setOnlyBelowPar((v) => !v)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium",
                onlyBelowPar ? "border-brand bg-brand-soft text-brand dark:text-text" : "border-border bg-surface text-text-2",
              )}
              aria-pressed={onlyBelowPar}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Below par only</span>
            </button>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No items here" description="Try another category, clear the search, or turn off the below-par filter." className="mt-4" />
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((p) => {
            const quotes = getQuotes(state, p);
            return (
              <ItemCard
                key={p.id}
                product={p}
                quotes={quotes}
                best={bestQuote(quotes, p.preferredVendorId)}
                qty={orderQty(state, p)}
                suggested={suggestedQty(p)}
                overridden={isOverridden(state, p)}
                onOnHand={(v) => actions.setOnHand(p.id, v)}
                onPar={(v) => actions.setPar(p.id, v)}
                onQty={(v) => actions.setOrderQty(p.id, v)}
                onClearQty={() => actions.setOrderQty(p.id, null)}
              />
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold text-text">{fmtNum(routing.units)} units</span>
            <span className="text-muted"> · {money(routing.total)}</span>
            {routing.savings > 0 ? <span className="text-success"> · saves {money(routing.savings)}</span> : null}
          </div>
          <Link href="/orders">
            <Button size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
              Review orders
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}

function CategoryChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-text-2 hover:bg-surface-2",
      )}
    >
      {label}
      {count > 0 ? (
        <span className={cn("rounded-full px-1.5 text-[11px] tabular", active ? "bg-white/20" : "bg-surface-3 text-muted")}>{count}</span>
      ) : null}
    </button>
  );
}

function ItemCard({
  product,
  quotes,
  best,
  qty,
  suggested,
  overridden,
  onOnHand,
  onPar,
  onQty,
  onClearQty,
}: {
  product: ProductRecord;
  quotes: VendorQuote[];
  best?: VendorQuote;
  qty: number;
  suggested: number;
  overridden: boolean;
  onOnHand: (v: number) => void;
  onPar: (v: number) => void;
  onQty: (v: number) => void;
  onClearQty: () => void;
}) {
  const unit = unitLabel(product.baseUnit);
  const needs = qty > 0;
  const others = quotes.filter((q) => q.vendorId !== best?.vendorId);
  return (
    <Card className={cn("flex flex-col gap-3 p-4", needs && "border-l-4 border-l-brand")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight text-text">{product.name}</div>
          <div className="mt-0.5 text-xs text-muted">
            {product.packSize} · {product.category}
          </div>
        </div>
        {best ? (
          <div className="shrink-0 text-right">
            <VendorBadge vendor={best.vendor} tone="solid" />
            <div className="tabular mt-1 text-xs text-muted">
              {money(best.landedPrice)}/{unit}
            </div>
          </div>
        ) : (
          <Badge tone="warning">No price</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stepper label="On hand" value={product.onHand} onChange={onOnHand} suffix={unit} />
        <Stepper label="Par" value={product.parLevel} onChange={onPar} suffix={unit} size="sm" className="justify-end" />
      </div>

      <div className={cn("flex items-center justify-between rounded-xl px-3 py-2", needs ? "bg-brand-soft" : "bg-surface-2")}>
        <div className="text-sm">
          <span className="text-muted">Order </span>
          <span className="tabular font-semibold text-text">
            {fmtNum(qty)} {unit}
          </span>
          {best && qty > 0 ? <span className="tabular text-muted"> · {money(qty * best.price)}</span> : null}
          {overridden ? (
            <button type="button" onClick={onClearQty} className="ml-2 text-xs font-medium text-accent hover:underline">
              reset to {fmtNum(suggested)}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Order less" onClick={() => onQty(Math.max(0, qty - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-text hover:bg-surface-3">
            −
          </button>
          <button type="button" aria-label="Order more" onClick={() => onQty(qty + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-text hover:bg-surface-3">
            +
          </button>
        </div>
      </div>

      {others.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {others.map((q) => (
            <span key={q.vendorId} className="tabular">
              {q.vendor.shortName} {money(q.landedPrice)}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
