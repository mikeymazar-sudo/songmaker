"use client";

import { Check, ChevronRight, Package, Plus, Search } from "lucide-react";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { VendorDot } from "@/components/ui/VendorBadge";
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
  const multiVendor = rows.filter((r) => r.quotes.length > 1).length;

  return (
    <>
      <PageHeader
        title="Products & prices"
        description="Everything you buy, with each vendor's price side by side. Prices include delivery fees, so the cheapest one really is the cheapest."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add product
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, pack size or vendor item #"
            className="pl-10"
            aria-label="Search products"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value as CategoryFilter)} className="md:w-64" aria-label="Category">
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border-strong bg-surface px-3.5 text-[15px] text-text-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          Show archived
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>
          {rows.length} product{rows.length === 1 ? "" : "s"} · {multiVendor} sold by more than one vendor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-5 items-center gap-1 rounded-md bg-success-soft px-1.5 text-[12px] font-semibold text-success">
            <Check className="h-3 w-3" strokeWidth={3} />$
          </span>
          = cheapest, fees included
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" />} title="No products match" description="Try a different search or category." />
      ) : (
        <>
          {/* Phones: one line per product with its best price; tap for every vendor */}
          <Card className="overflow-hidden md:hidden">
            <ul className="divide-y divide-border">
              {rows.map(({ product, quotes, best, spread }, i) => {
                const need = suggestedQty(product);
                const newGroup = i === 0 || rows[i - 1].product.category !== product.category;
                return (
                  <Fragment key={product.id}>
                    {newGroup ? (
                      <li className="bg-surface-2/70 px-4 pb-2 pt-4 text-[15px] font-semibold text-text">{product.category}</li>
                    ) : null}
                    <li>
                      <button
                        type="button"
                        onClick={() => setSelectedId(product.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2",
                          product.archived && "opacity-60",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-medium text-text">{product.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                            <span className="tabular">
                              {fmtNum(product.onHand)} / {fmtNum(product.parLevel)} on hand
                            </span>
                            {need > 0 ? <span className="font-medium text-warning">· order {fmtNum(need)}</span> : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {best ? (
                            <>
                              <div className="tabular text-[15px] font-semibold text-text">{money(best.landedPrice)}</div>
                              <div className="flex items-center justify-end gap-1 text-[12px] text-muted">
                                <VendorDot vendor={best.vendor} className="h-2 w-2" />
                                {best.vendor.shortName}
                                {spread ? ` · ${quotes.length} vendors` : ""}
                              </div>
                            </>
                          ) : (
                            <span className="text-[13px] text-muted">No price</span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          </Card>
          <Card className="hidden overflow-hidden md:block">
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th className="min-w-56">Product</Th>
                    <Th>On hand / par</Th>
                    {state.vendors.map((v) => (
                      <Th key={v.id} align="right">
                        <span className="inline-flex items-center gap-1.5">
                          <VendorDot vendor={v} />
                          {v.shortName}
                        </span>
                      </Th>
                    ))}
                    <Th align="right" title="How much more the priciest vendor charges than the cheapest">
                      Price gap
                    </Th>
                    <Th />
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
                            <td
                              colSpan={state.vendors.length + 4}
                              className="border-b border-border bg-surface-2/70 px-5 pb-2 pt-4 text-[15px] font-semibold text-text"
                            >
                              {product.category}
                            </td>
                          </tr>
                        ) : null}
                        <tr
                          onClick={() => setSelectedId(product.id)}
                          className={cn("cursor-pointer hover:bg-surface-2/70", product.archived && "opacity-60")}
                        >
                          <Td className="whitespace-normal">
                            <div className="text-[15px] font-medium text-text">{product.name}</div>
                            <div className="text-[13px] text-muted">
                              {product.packSize} · priced per {product.baseUnit}
                              {product.archived ? " · archived" : ""}
                            </div>
                          </Td>
                          <Td className="whitespace-nowrap">
                            <span className="tabular text-text">
                              {fmtNum(product.onHand)} / {fmtNum(product.parLevel)}
                            </span>
                            {need > 0 ? (
                              <Badge tone="warning" className="ml-2">
                                Order {fmtNum(need)}
                              </Badge>
                            ) : null}
                          </Td>
                          {state.vendors.map((v) => {
                            const q = quotes.find((x) => x.vendorId === v.id);
                            const isBest = q && best && q.vendorId === best.vendorId;
                            return (
                              <Td
                                key={v.id}
                                align="right"
                                className={cn(isBest && quotes.length > 1 && "bg-success-soft/70 font-semibold text-success")}
                              >
                                {q ? (
                                  <>
                                    <span className="inline-flex items-center gap-1">
                                      {isBest && quotes.length > 1 ? (
                                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-label="Cheapest" />
                                      ) : null}
                                      {money(q.landedPrice)}
                                    </span>
                                    {q.landedPrice !== q.price ? (
                                      <div className="text-[11px] font-normal text-muted">{money(q.price)} + fee</div>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </Td>
                            );
                          })}
                          <Td align="right">
                            {spread ? (
                              <Badge tone={spread.spreadPct > 0.25 ? "danger" : spread.spreadPct > 0.08 ? "warning" : "neutral"}>
                                {pct(spread.spreadPct, 0)}
                              </Badge>
                            ) : (
                              <span className="text-[13px] text-muted">{quotes.length === 1 ? "Only 1 vendor" : "No prices"}</span>
                            )}
                          </Td>
                          <Td>
                            <ChevronRight className="h-4 w-4 text-muted" />
                          </Td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </>
      )}

      <ProductDrawer product={selected} onClose={() => setSelectedId(null)} />
      <ProductFormModal open={adding} onClose={() => setAdding(false)} onSaved={(p) => setSelectedId(p.id)} />
    </>
  );
}
