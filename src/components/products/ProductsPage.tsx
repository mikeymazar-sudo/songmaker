"use client";

import { ChevronRight, Package, Plus, Search } from "lucide-react";
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
          state.vendorProducts.some((vp) => vp.productId === p.id && (vp.sku.toLowerCase().includes(t) || vp.description.toLowerCase().includes(t))),
      )
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .map((p) => {
        const quotes = getQuotes(state, p);
        return { product: p, quotes, best: bestQuote(quotes, p.preferredVendorId), spread: priceSpread(quotes) };
      });
  }, [state, query, category, showArchived]);

  const selected: ProductRecord | null = selectedId ? state.products.find((p) => p.id === selectedId) ?? null : null;
  const multiVendor = rows.filter((r) => r.quotes.length > 1).length;

  return (
    <>
      <PageHeader
        title="Master Products"
        description="One canonical record per product. Vendor prices are normalized to the product's base unit and shown landed, so a 10% runner fee or a $45 delivery charge can't hide."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add product
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, pack, vendor SKU or description…" className="pl-9" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value as CategoryFilter)} className="md:w-64" aria-label="Category">
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm text-text-2">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Show archived
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>
          {rows.length} product{rows.length === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span>{multiVendor} with 2+ vendor prices</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-success-soft ring-1 ring-success/40" /> cheapest landed price
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title="No products match" description="Try a different search or category." />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th className="min-w-56">Product</Th>
                  <Th>Stock</Th>
                  {state.vendors.map((v) => (
                    <Th key={v.id} align="right">
                      <span className="inline-flex items-center gap-1.5">
                        <VendorDot vendor={v} />
                        {v.shortName}
                      </span>
                    </Th>
                  ))}
                  <Th align="right">Spread</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, quotes, best, spread }) => {
                  const need = suggestedQty(product);
                  return (
                    <tr
                      key={product.id}
                      onClick={() => setSelectedId(product.id)}
                      className={cn("cursor-pointer hover:bg-surface-2/70", product.archived && "opacity-60")}
                    >
                      <Td className="whitespace-normal">
                        <div className="font-medium text-text">{product.name}</div>
                        <div className="text-xs text-muted">
                          {product.category} · {product.packSize} · per {product.baseUnit}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="tabular text-text">
                          {fmtNum(product.onHand)} / {fmtNum(product.parLevel)}
                        </span>
                        {need > 0 ? <Badge tone="warning" className="ml-2">order {fmtNum(need)}</Badge> : null}
                      </Td>
                      {state.vendors.map((v) => {
                        const q = quotes.find((x) => x.vendorId === v.id);
                        const isBest = q && best && q.vendorId === best.vendorId;
                        return (
                          <Td key={v.id} align="right" className={cn(isBest && "bg-success-soft/60 font-semibold text-success")}>
                            {q ? (
                              <>
                                {money(q.landedPrice)}
                                {q.landedPrice !== q.price ? <div className="text-[10px] font-normal text-muted">{money(q.price)} + fee</div> : null}
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </Td>
                        );
                      })}
                      <Td align="right">
                        {spread ? (
                          <Badge tone={spread.spreadPct > 0.25 ? "danger" : spread.spreadPct > 0.08 ? "warning" : "neutral"}>{pct(spread.spreadPct, 0)}</Badge>
                        ) : (
                          <span className="text-xs text-muted">{quotes.length === 1 ? "1 vendor" : "—"}</span>
                        )}
                      </Td>
                      <Td>
                        <ChevronRight className="h-4 w-4 text-muted" />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <ProductDrawer product={selected} onClose={() => setSelectedId(null)} />
      <ProductFormModal open={adding} onClose={() => setAdding(false)} onSaved={(p) => setSelectedId(p.id)} />
    </>
  );
}
