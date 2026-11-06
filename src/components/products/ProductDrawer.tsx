"use client";

import { Archive, ArchiveRestore, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { Stepper } from "@/components/ui/Stepper";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { VendorBadge } from "@/components/ui/VendorBadge";
import { fmtDate, fmtNum, money, pct, signedPct, unitLabel } from "@/lib/format";
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
        subtitle={`${product.category} · ${product.packSize} · compared per ${product.baseUnit}`}
        footer={
          <>
            <Button
              variant="outline"
              icon={product.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              onClick={() => actions.archiveProduct(product.id, !product.archived)}
            >
              {product.archived ? "Restore" : "Archive"}
            </Button>
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit product
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3">
            <Stepper label="On hand" value={product.onHand} onChange={(v) => actions.setOnHand(product.id, v)} suffix={unit} />
            <Stepper label="Par level" value={product.parLevel} onChange={(v) => actions.setPar(product.id, v)} suffix={unit} />
            <div className="col-span-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>
                Suggested order: <span className="font-semibold text-text">{fmtNum(suggestedQty(product))} {unit}</span>
              </span>
              {product.preferredVendorId ? (
                <Badge tone="brand">Preferred: {state.vendors.find((v) => v.id === product.preferredVendorId)?.shortName}</Badge>
              ) : null}
              {product.archived ? <Badge tone="warning">Archived</Badge> : null}
            </div>
            {product.notes ? <p className="col-span-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-text-2">{product.notes}</p> : null}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-text">Vendor prices</h3>
            {quotes.length === 0 ? (
              <p className="text-sm text-muted">No vendor has a price for this product yet. Approve an invoice that includes it.</p>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Vendor</Th>
                      <Th>SKU · pack</Th>
                      <Th align="right">Price</Th>
                      <Th align="right">Landed</Th>
                      <Th>Source</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q) => (
                      <tr key={q.vendorId} className={q.vendorId === best?.vendorId ? "bg-success-soft/50" : undefined}>
                        <Td>
                          <VendorBadge vendor={q.vendor} tone="plain" />
                          {q.vendorId === best?.vendorId ? <span className="ml-2 text-[11px] font-semibold uppercase text-success">best</span> : null}
                        </Td>
                        <Td className="whitespace-normal">
                          <div className="font-mono text-xs text-muted">{q.sku}</div>
                          <div className="text-xs text-text-2">{q.packSize}</div>
                        </Td>
                        <Td align="right">{money(q.price)}</Td>
                        <Td align="right" className="font-medium">
                          {money(q.landedPrice)}
                        </Td>
                        <Td className="text-xs text-muted">
                          {q.source === "invoice" ? `Invoice · ${fmtDate(q.lastInvoiceDate)}` : "Price sheet"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            {spread ? (
              <p className="mt-2 text-xs text-muted">
                Spread between cheapest and most expensive: {money(spread.high - spread.low)}/{unit} ({pct(spread.spreadPct, 0)}).
              </p>
            ) : null}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-text">Price history</h3>
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
