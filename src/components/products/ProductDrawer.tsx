"use client";

import { Archive, ArchiveRestore, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { Stepper } from "@/components/ui/Stepper";
import { VendorBadge } from "@/components/ui/VendorBadge";
import { cn, fmtDate, fmtNum, money, pct, signedPct, unitLabel } from "@/lib/format";
import type { ProductRecord } from "@/lib/models";
import { bestQuote, getQuotes, priceSpread, suggestedQty } from "@/lib/pricing";
import { useActions, useApp } from "@/lib/store";
import { ProductFormModal } from "./ProductForm";

export function ProductDrawer({ product, onClose }: { product: ProductRecord | null; onClose: () => void }) {
  const { state } = useApp();
  const actions = useActions();
  const [editing, setEditing] = useState(false);

  const quotes = useMemo(() => (product ? getQuotes(state, product) : []), [state, product]);
  const best = product ? bestQuote(quotes, product.preferredVendorId) : undefined;
  const spread = priceSpread(quotes);
  const history = useMemo(
    () => (product ? state.priceHistory.filter((h) => h.productId === product.id) : []),
    [state.priceHistory, product],
  );

  if (!product) return null;
  const unit = unitLabel(product.baseUnit);

  return (
    <>
      <Drawer
        open={!!product}
        onClose={onClose}
        title={product.name}
        subtitle={`${product.category} · ${product.packSize} · prices compared per ${product.baseUnit}`}
        footer={
          <>
            <Button
              variant="outline"
              icon={product.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              onClick={() => actions.archiveProduct(product.id, !product.archived)}
            >
              {product.archived ? "Bring back" : "Archive"}
            </Button>
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit details
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3">
            <Stepper label="On hand now" value={product.onHand} onChange={(v) => actions.setOnHand(product.id, v)} suffix={unit} />
            <Stepper label="Par (full shelf)" value={product.parLevel} onChange={(v) => actions.setPar(product.id, v)} suffix={unit} />
            <div className="col-span-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>
                Next order: <span className="font-semibold text-text">{fmtNum(suggestedQty(product))} {unit}</span>
              </span>
              {product.preferredVendorId ? (
                <Badge tone="brand">Usual vendor: {state.vendors.find((v) => v.id === product.preferredVendorId)?.shortName}</Badge>
              ) : null}
              {product.archived ? <Badge tone="warning">Archived</Badge> : null}
            </div>
            {product.notes ? <p className="col-span-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-text-2">{product.notes}</p> : null}
          </section>

          <section>
            <h3 className="mb-1 text-[15px] font-semibold text-text">Price at each vendor</h3>
            <p className="mb-3 text-[13px] text-muted">Per {product.baseUnit}, including that vendor&apos;s delivery fees. Cheapest first.</p>
            {quotes.length === 0 ? (
              <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">
                No vendor has a price for this yet. It gets one when you approve an invoice that includes it.
              </p>
            ) : (
              <ul className="space-y-2">
                {quotes.map((q) => {
                  const isBest = q.vendorId === best?.vendorId;
                  return (
                    <li
                      key={q.vendorId}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3.5 py-3",
                        isBest ? "border-success/40 bg-success-soft/60" : "border-border",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <VendorBadge vendor={q.vendor} tone="plain" />
                          {isBest && quotes.length > 1 ? <Badge tone="success">Cheapest</Badge> : null}
                        </div>
                        <div className="mt-0.5 text-[13px] text-muted">
                          {q.packSize}
                          {q.sku ? ` · Item # ${q.sku}` : ""} ·{" "}
                          {q.source === "invoice" ? `from invoice, ${fmtDate(q.lastInvoiceDate)}` : "from price sheet"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("tabular text-base font-semibold", isBest ? "text-success" : "text-text")}>{money(q.landedPrice)}</div>
                        {q.landedPrice !== q.price ? <div className="tabular text-[12px] text-muted">{money(q.price)} + fee</div> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {spread ? (
              <p className="mt-2 text-[13px] text-muted">
                The priciest vendor charges {money(spread.high - spread.low)} more per {unit} ({pct(spread.spreadPct, 0)}).
              </p>
            ) : null}
          </section>

          <section>
            <h3 className="mb-2 text-[15px] font-semibold text-text">Price history</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted">No recorded invoice prices yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {history.map((h) => {
                  const vendor = state.vendors.find((v) => v.id === h.vendorId);
                  const delta = h.previousPrice ? (h.price - h.previousPrice) / h.previousPrice : 0;
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-24 shrink-0 text-xs text-muted">{fmtDate(h.date)}</span>
                      {vendor ? <VendorBadge vendor={vendor} /> : null}
                      <span className="tabular ml-auto font-medium text-text">
                        {money(h.price)}/{unitLabel(h.priceUnit)}
                      </span>
                      {h.previousPrice !== undefined && Math.abs(delta) > 0.005 ? (
                        <span className={`flex items-center gap-1 text-xs ${delta > 0 ? "text-danger" : "text-success"}`}>
                          {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {signedPct(delta)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </Drawer>
      <ProductFormModal open={editing} onClose={() => setEditing(false)} product={product} />
    </>
  );
}
