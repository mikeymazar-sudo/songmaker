"use client";

import { ArrowRight, Check, Info, Pencil, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { VendorDot } from "@/components/ui/VendorBadge";
import { CATEGORIES } from "@/data/types";
import { cn, fmtNum, money, unitLabel } from "@/lib/format";
import type { CategoryFilter, ProductRecord, VendorQuote } from "@/lib/models";
import { bestQuote, getQuotes, isOverridden, orderQty, routeOrder, suggestedQty } from "@/lib/pricing";
import { useActions, useApp } from "@/lib/store";

// Shared column layout for the header row and every item row (tablet and up).
const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_10.5rem_9.5rem_10.5rem] md:items-center md:gap-4";

export function WalkInPage() {
  const { state } = useApp();
  const actions = useActions();
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [query, setQuery] = useState("");
  const [onlyToOrder, setOnlyToOrder] = useState(false);

  const routing = useMemo(() => routeOrder(state), [state]);
  const active = useMemo(() => state.products.filter((p) => !p.archived), [state.products]);

  const toOrderByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of active) if (orderQty(state, p) > 0) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, [active, state]);

  const groups = useMemo(() => {
    const t = query.trim().toLowerCase();
    const visible = active
      .filter((p) => category === "All" || p.category === category)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.packSize.toLowerCase().includes(t))
      .filter((p) => !onlyToOrder || orderQty(state, p) > 0);
    return CATEGORIES.map((c) => ({
      category: c,
      items: visible.filter((p) => p.category === c).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.items.length > 0);
  }, [active, category, query, onlyToOrder, state]);

  const categoriesInUse = CATEGORIES.filter((c) => active.some((p) => p.category === c));
  const totalToOrder = Object.values(toOrderByCategory).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader
        title="Count stock"
        description="Walk the cooler, freezer and shelves. Tap + or − until each number matches what you see. The order fills itself in."
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-surface-3/70 px-4 py-3 text-sm text-text-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <p>
          <span className="font-medium text-text">Par</span> is how much you want on the shelf after a delivery. We order the difference,
          from whichever vendor is cheapest.
        </p>
      </div>

      {/* Filters stay on screen while you scroll the list */}
      <div className="sticky top-16 z-20 -mx-4 bg-bg/95 px-4 pb-3 pt-2 backdrop-blur md:-mx-6 md:px-6 lg:-mx-10 lg:px-10">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <CategoryChip active={category === "All"} onClick={() => setCategory("All")} label="Everything" count={totalToOrder} />
          {categoriesInUse.map((c) => (
            <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)} label={c} count={toOrderByCategory[c] ?? 0} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an item"
              className="pl-10"
              aria-label="Find an item"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface-3"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setOnlyToOrder((v) => !v)}
            aria-pressed={onlyToOrder}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-[15px] font-medium transition-colors",
              onlyToOrder ? "border-brand bg-brand text-brand-fg" : "border-border-strong bg-surface text-text-2 hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border",
                onlyToOrder ? "border-brand-fg bg-brand-fg text-brand" : "border-border-strong",
              )}
            >
              {onlyToOrder ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className="hidden sm:inline">Only items to order</span>
            <span className="sm:hidden">To order</span>
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={onlyToOrder ? "No items in this category need ordering." : "Try another category or clear the search."}
          className="mt-2"
        />
      ) : (
        <Card className="mt-1 overflow-hidden">
          <div className={cn("hidden border-b border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted", COLS)}>
            <span>Item</span>
            <span>On hand now</span>
            <span>Par</span>
            <span>To order</span>
          </div>
          {groups.map((g) => (
            <section key={g.category} aria-label={g.category}>
              <h2 className="flex items-baseline gap-2 border-b border-border bg-surface-2/60 px-5 pb-2 pt-4 text-[15px] font-semibold text-text">
                {g.category}
                <span className="text-[13px] font-normal text-muted">
                  {g.items.length} item{g.items.length === 1 ? "" : "s"}
                  {toOrderByCategory[g.category] ? ` · ${toOrderByCategory[g.category]} to order` : ""}
                </span>
              </h2>
              <ul className="divide-y divide-border">
                {g.items.map((p) => {
                  const quotes = getQuotes(state, p);
                  return (
                    <ItemRow
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
              </ul>
            </section>
          ))}
        </Card>
      )}

      {/* Running total, always in reach */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64 lg:px-10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] text-muted">Your order so far</div>
            <div className="truncate text-[15px] sm:text-base">
              <span className="tabular font-semibold text-text">{money(routing.total)}</span>
              <span className="text-muted"> · {fmtNum(routing.units)} units</span>
              {routing.savings > 0 ? <span className="tabular text-success"> · saves {money(routing.savings)}</span> : null}
            </div>
          </div>
          <Link href="/orders">
            <Button iconRight={<ArrowRight className="h-4 w-4" />}>
              <span className="hidden sm:inline">Review the order</span>
              <span className="sm:hidden">Review</span>
            </Button>
          </Link>
        </div>
      </div>
      <div className="h-16" aria-hidden />
    </>
  );
}

function CategoryChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[15px] font-medium transition-colors",
        active ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-text-2 hover:bg-surface-2",
      )}
    >
      {label}
      {count > 0 ? (
        <span
          className={cn("rounded-full px-1.5 text-xs font-semibold tabular", active ? "bg-brand-fg/20" : "bg-warning-soft text-warning")}
          title={`${count} to order`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ItemRow({
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
  const [editingPar, setEditingPar] = useState(false);
  const needs = qty > 0;
  const runningOut = product.onHand <= 0;

  return (
    <li className={cn("px-5 py-4", COLS)}>
      {/* Item */}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-base font-medium leading-snug text-text">{product.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            <span>{product.packSize}</span>
            {best ? (
              <span
                className="inline-flex items-center gap-1.5"
                title={quotes.length > 1 ? `Cheapest of ${quotes.length} vendors` : "Only vendor"}
              >
                · <VendorDot vendor={best.vendor} className="h-2 w-2" />
                {best.vendor.shortName} {money(best.landedPrice)}/{unit}
              </span>
            ) : (
              <span className="text-warning">· No vendor price yet</span>
            )}
          </div>
        </div>
      </div>

      {/* On hand */}
      <div className="mt-3 md:mt-0">
        <Stepper
          label={`${product.name} on hand`}
          hideLabel
          value={product.onHand}
          onChange={onOnHand}
          suffix={unit}
          size="lg"
          className={cn(runningOut && "[&>div]:border-danger/50")}
        />
      </div>

      {/* Par and To order share a line on phones, and get their own columns on wider screens */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:contents">
        <div className="flex items-center gap-2">
          {editingPar ? (
            <div className="flex items-center gap-1">
              <Stepper
                label={`${product.name} par`}
                hideLabel
                value={product.parLevel}
                onChange={onPar}
                suffix={unit}
                size="sm"
                className="w-32"
              />
              <button
                type="button"
                onClick={() => setEditingPar(false)}
                className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-text"
                aria-label="Done editing par"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingPar(true)}
              className="group inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[15px] text-text-2 hover:bg-surface-3 md:-ml-2"
              aria-label={`Change par for ${product.name}, now ${fmtNum(product.parLevel)} ${unit}`}
            >
              <span className="text-muted md:hidden">Par</span>
              <span className="tabular font-medium text-text">
                {fmtNum(product.parLevel)} {unit}
              </span>
              <Pencil className="h-3.5 w-3.5 text-muted opacity-60 group-hover:opacity-100" />
            </button>
          )}
        </div>

        {/* To order */}
        <div>
          <div className="flex items-center gap-2">
            <OrderPill qty={qty} unit={unit} best={best} />
            {needs || overridden ? (
              <div className="flex">
                <button
                  type="button"
                  aria-label={`Order less ${product.name}`}
                  onClick={() => onQty(Math.max(0, qty - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-l-lg border border-border-strong text-text-2 hover:bg-surface-3"
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={`Order more ${product.name}`}
                  onClick={() => onQty(qty + 1)}
                  className="-ml-px flex h-8 w-8 items-center justify-center rounded-r-lg border border-border-strong text-text-2 hover:bg-surface-3"
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
          {overridden ? (
            <button type="button" onClick={onClearQty} className="mt-1 text-[12px] font-medium text-accent hover:underline">
              You changed this · back to {fmtNum(suggested)}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function OrderPill({ qty, unit, best }: { qty: number; unit: string; best?: VendorQuote }) {
  if (qty <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[15px] text-success">
        <Check className="h-4 w-4" /> Stocked
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-start">
      <span className="tabular whitespace-nowrap rounded-lg bg-warning-soft px-2.5 py-1 text-[15px] font-semibold text-warning">
        <span className="md:hidden">Order </span>
        {fmtNum(qty)} {unit}
      </span>
      {best ? <span className="tabular mt-0.5 text-[12px] text-muted">{money(qty * best.price)}</span> : null}
    </span>
  );
}
