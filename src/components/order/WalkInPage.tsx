"use client";

import { ArrowRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import { Modal } from "@/components/ui/Overlay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stepper, StepperRow } from "@/components/ui/Stepper";
import { Tabs } from "@/components/ui/Tabs";
import { CATEGORIES } from "@/data/types";
import { cn, fmtNum, money, unitLabel } from "@/lib/format";
import type { CategoryFilter, ProductRecord } from "@/lib/models";
import { bestQuote, getQuotes, isOverridden, orderQty, routeOrder, suggestedQty } from "@/lib/pricing";
import { useActions, useApp } from "@/lib/store";

// Item, par, to order, on hand. Phones show only the item and its stepper.
const COLS = "md:grid-cols-[minmax(0,1fr)_5rem_6rem_9rem]";

export function WalkInPage() {
  const { state } = useApp();
  const actions = useActions();
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [query, setQuery] = useState("");
  const [onlyToOrder, setOnlyToOrder] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

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
  const opened = openId ? (state.products.find((p) => p.id === openId) ?? null) : null;

  return (
    <>
      <PageHeader
        title="Count"
        description="Tap + or − to match the shelf."
        actions={
          <button
            type="button"
            onClick={() => setOnlyToOrder((v) => !v)}
            aria-pressed={onlyToOrder}
            className={cn(
              "h-10 rounded-full px-4 text-sm font-medium transition-colors",
              onlyToOrder ? "bg-brand text-brand-fg" : "bg-surface-3 text-text-2",
            )}
          >
            To order
          </button>
        }
      />

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={1.75} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an item"
          enterKeyHint="search"
          className="border-transparent bg-surface-3 pl-10 pr-11 focus:bg-surface"
          aria-label="Find an item"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Categories stay in reach while the list scrolls */}
      <div className="sticky top-[var(--topbar-h)] z-10 -mx-4 bg-bg px-4 md:mx-0 md:px-0">
        <Tabs
          value={category}
          onChange={setCategory}
          options={[
            { value: "All" as CategoryFilter, label: "All", count: totalToOrder },
            ...categoriesInUse.map((c) => ({ value: c as CategoryFilter, label: c, count: toOrderByCategory[c] ?? 0 })),
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Nothing here" description={onlyToOrder ? "No items in this category need ordering." : "Try another category or clear the search."} />
      ) : (
        <>
          <div className={cn("hidden gap-4 pt-4 text-[13px] font-medium text-muted md:grid", COLS)}>
            <span>Item</span>
            <span>Par</span>
            <span>To order</span>
            <span className="text-center">On hand</span>
          </div>
          {groups.map((g) => (
            <section key={g.category} aria-label={g.category}>
              <h2 className="border-b border-border pb-2 pt-6 text-[13px] font-semibold text-muted">{g.category}</h2>
              <List>
                {g.items.map((p) => (
                  <ItemRow key={p.id} product={p} qty={orderQty(state, p)} onOpen={() => setOpenId(p.id)} onOnHand={(v) => actions.setOnHand(p.id, v)} />
                ))}
              </List>
            </section>
          ))}
        </>
      )}

      {/* Running total, always in reach */}
      <div className="no-print fixed inset-x-0 bottom-[var(--tabbar-h)] z-10 border-t border-border bg-bg">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 md:h-16 md:px-8">
          <div className="min-w-0 truncate text-[15px]">
            <span className="tabular font-semibold text-text">{money(routing.total)}</span>
            <span className="text-muted"> · {fmtNum(routing.units)} unit{routing.units === 1 ? "" : "s"}</span>
            {routing.savings > 0 ? <span className="tabular hidden text-success sm:inline"> · saves {money(routing.savings)}</span> : null}
          </div>
          <Link href="/orders" className={buttonStyles("primary", "sm")}>
            Review
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="h-14 md:h-16" aria-hidden />

      <ItemSheet product={opened} onClose={() => setOpenId(null)} />
    </>
  );
}

function ItemRow({ product, qty, onOpen, onOnHand }: { product: ProductRecord; qty: number; onOpen: () => void; onOnHand: (v: number) => void }) {
  const unit = unitLabel(product.baseUnit);
  return (
    <li className={cn("flex items-center gap-3 py-2.5 md:grid md:gap-4", COLS)}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left active:opacity-60">
        <span className="line-clamp-2 text-[15px] font-medium leading-snug text-text">{product.name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-muted md:hidden">
          Par {fmtNum(product.parLevel)}
          {qty > 0 ? (
            <>
              {" · "}
              <span className="font-medium text-text">
                order {fmtNum(qty)} {unit}
              </span>
            </>
          ) : null}
        </span>
        <span className="mt-0.5 hidden truncate text-[13px] text-muted md:block">{product.packSize}</span>
      </button>
      <span className="tabular hidden text-[15px] text-text-2 md:block">
        {fmtNum(product.parLevel)} {unit}
      </span>
      <span className={cn("tabular hidden text-[15px] md:block", qty > 0 ? "font-semibold text-text" : "text-muted")}>
        {qty > 0 ? `${fmtNum(qty)} ${unit}` : "—"}
      </span>
      <Stepper label={`${product.name} on hand`} value={product.onHand} onChange={onOnHand} alert={product.onHand <= 0} />
    </li>
  );
}

function ItemSheet({ product, onClose }: { product: ProductRecord | null; onClose: () => void }) {
  const { state } = useApp();
  const actions = useActions();
  if (!product) return null;

  const unit = unitLabel(product.baseUnit);
  const quotes = getQuotes(state, product);
  const best = bestQuote(quotes, product.preferredVendorId);
  const qty = orderQty(state, product);
  const suggested = suggestedQty(product);
  const overridden = isOverridden(state, product);

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={product.name}
      subtitle={`${product.packSize} · counted in ${unit}`}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="divide-y divide-border border-b border-border">
        <StepperRow label="On hand" value={product.onHand} onChange={(v) => actions.setOnHand(product.id, v)} />
        <StepperRow label="Par" hint="What you want after a delivery" value={product.parLevel} onChange={(v) => actions.setPar(product.id, v)} />
        <StepperRow
          label="To order"
          hint={
            overridden ? (
              <button type="button" onClick={() => actions.setOrderQty(product.id, null)} className="font-medium text-text underline underline-offset-2">
                Back to {fmtNum(suggested)}
              </button>
            ) : (
              "Par minus on hand"
            )
          }
          value={qty}
          onChange={(v) => actions.setOrderQty(product.id, v)}
        />
      </div>
      {quotes.length === 0 ? (
        <p className="pt-4 text-[15px] text-muted">No vendor has a price for this yet.</p>
      ) : (
        <ul className="pt-2">
          {quotes.map((q) => (
            <li key={q.vendorId} className="flex items-center justify-between gap-3 py-1.5 text-[15px]">
              <span className={cn("truncate", q.vendorId === best?.vendorId ? "font-medium text-text" : "text-muted")}>
                {q.vendor.name}
                {q.vendorId === best?.vendorId && quotes.length > 1 ? <span className="ml-2 text-[13px] font-medium text-success">Cheapest</span> : null}
              </span>
              <span className={cn("tabular shrink-0", q.vendorId === best?.vendorId ? "font-medium text-text" : "text-muted")}>
                {money(q.landedPrice)}/{unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
