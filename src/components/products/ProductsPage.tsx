"use client";

import { Check, Plus, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { List, Row } from "@/components/ui/List";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td, Th } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { CATEGORIES } from "@/data/types";
import { cn, fmtNum, money, pct } from "@/lib/format";
import type { CategoryFilter, ProductRecord } from "@/lib/models";
import { bestQuote, getQuotes, priceSpread, suggestedQty } from "@/lib/pricing";
import { useApp } from "@/lib/store";
import { ProductDrawer } from "./ProductDrawer";
import { ProductFormModal } from "./ProductForm";

export function ProductsPage() {
  const { state, ui, setUi } = useApp();
  const [query, setQuery] = useState(ui.productQuery);
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(ui.selectedProductId);
  const [adding, setAdding] = useState(false);
  const [seenNonce, setSeenNonce] = useState(ui.nonce);

  // Global search hands off a query / product while this page is already mounted.
  if (ui.nonce !== seenNonce) {
    setSeenNonce(ui.nonce);
    setQuery(ui.productQuery);
    setSelectedId(ui.selectedProductId);
  }

  useEffect(() => {
    if (ui.productQuery || ui.selectedProductId) setUi({ productQuery: "", selectedProductId: null });
  }, [ui.productQuery, ui.selectedProductId, setUi]);

  const rows = useMemo(() => {
    const t = query.trim().toLowerCase();
    return state.products
      .filter((p) => showArchived || !p.archived)
      .filter((p) => category === "All" || p.category === category)
      .filter(
        (p) =>
          !t ||
          p.name.toLowerCase().includes(t) ||
          p.packSize.toLowerCase().includes(t) ||
          state.vendorProducts.some(
            (vp) => vp.productId === p.id && (vp.sku.toLowerCase().includes(t) || vp.description.toLowerCase().includes(t)),
          ),
      )
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .map((p) => {
        const quotes = getQuotes(state, p);
        return { product: p, quotes, best: bestQuote(quotes, p.preferredVendorId), spread: priceSpread(quotes) };
      });
  }, [state, query, category, showArchived]);

  const selected: ProductRecord | null = selectedId ? (state.products.find((p) => p.id === selectedId) ?? null) : null;
  const categoriesInUse = CATEGORIES.filter((c) => state.products.some((p) => p.category === c));

  return (
    <>
      <PageHeader
        title="Items"
        description="Best price, delivery fees included."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add
          </Button>
        }
      />

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={1.75} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, pack size or vendor item #"
          enterKeyHint="search"
          className="border-transparent bg-surface-3 pl-10 focus:bg-surface"
          aria-label="Search items"
        />
      </div>

      <div className="sticky top-[var(--topbar-h)] z-10 -mx-4 bg-bg px-4 md:mx-0 md:px-0">
        <Tabs
          value={category}
          onChange={setCategory}
          options={[{ value: "All" as CategoryFilter, label: "All" }, ...categoriesInUse.map((c) => ({ value: c as CategoryFilter, label: c }))]}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 text-[13px] text-muted">
        <span>
          {rows.length} item{rows.length === 1 ? "" : "s"}
        </span>
        <label className="flex h-9 cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Show archived
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No items match" description="Try a different search or category." />
      ) : (
        <>
          {/* Phones and portrait tablets: one line per item with its best price; tap for every vendor */}
          <div className="lg:hidden">
            {rows.map(({ product, best }, i) => {
              const need = suggestedQty(product);
              const newGroup = i === 0 || rows[i - 1].product.category !== product.category;
              return (
                <Fragment key={product.id}>
                  {newGroup ? <h2 className="border-b border-border pb-2 pt-5 text-[13px] font-semibold text-muted">{product.category}</h2> : null}
                  <List>
                    <li className="border-b border-border">
                      <Row
                        onClick={() => setSelectedId(product.id)}
                        className={cn(product.archived && "opacity-50")}
                        title={product.name}
                        subtitle={
                          <>
                            {fmtNum(product.onHand)} of {fmtNum(product.parLevel)} on hand
                            {need > 0 ? <span className="font-medium text-text"> · order {fmtNum(need)}</span> : null}
                          </>
                        }
                        value={best ? money(best.landedPrice) : <span className="text-muted">No price</span>}
                        detail={best ? best.vendor.shortName : undefined}
                      />
                    </li>
                  </List>
                </Fragment>
              );
            })}
          </div>

          {/* Wide screens: side-by-side price matrix */}
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <thead>
                <tr>
                  <Th className="min-w-52">Item</Th>
                  <Th>On hand</Th>
                  {state.vendors.map((v) => (
                    <Th key={v.id} align="right">
                      {v.shortName}
                    </Th>
                  ))}
                  <Th align="right" title="How much more the priciest vendor charges than the cheapest">
                    Gap
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, quotes, best, spread }, i) => {
                  const need = suggestedQty(product);
                  const newGroup = i === 0 || rows[i - 1].product.category !== product.category;
                  return (
                    <Fragment key={product.id}>
                      {newGroup ? (
                        <tr>
                          <td colSpan={state.vendors.length + 3} className="border-b border-border pb-2 pt-6 text-[13px] font-semibold text-muted">
                            {product.category}
                          </td>
                        </tr>
                      ) : null}
                      <tr onClick={() => setSelectedId(product.id)} className={cn("cursor-pointer hover:bg-surface-2", product.archived && "opacity-50")}>
                        <Td>
                          <div className="text-[15px] font-medium text-text">{product.name}</div>
                          <div className="text-[13px] text-muted">
                            {product.packSize}
                            {product.archived ? " · archived" : ""}
                          </div>
                        </Td>
                        <Td className="tabular whitespace-nowrap">
                          {fmtNum(product.onHand)} / {fmtNum(product.parLevel)}
                          {need > 0 ? <div className="text-[13px] font-medium text-text">order {fmtNum(need)}</div> : null}
                        </Td>
                        {state.vendors.map((v) => {
                          const q = quotes.find((x) => x.vendorId === v.id);
                          const cheapest = q && best && q.vendorId === best.vendorId && quotes.length > 1;
                          return (
                            <Td key={v.id} align="right" className={cn(cheapest && "font-semibold text-success")}>
                              {q ? (
                                <span className="inline-flex items-center gap-1">
                                  {cheapest ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-label="Cheapest" /> : null}
                                  {money(q.landedPrice)}
                                </span>
                              ) : (
                                <span className="text-border-strong">—</span>
                              )}
                            </Td>
                          );
                        })}
                        <Td align="right" className="text-muted">
                          {spread ? pct(spread.spreadPct, 0) : "—"}
                        </Td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </>
      )}

      <ProductDrawer product={selected} onClose={() => setSelectedId(null)} />
      <ProductFormModal open={adding} onClose={() => setAdding(false)} onSaved={(p) => setSelectedId(p.id)} />
    </>
  );
}
