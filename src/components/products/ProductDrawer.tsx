"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { List, Row, Section } from "@/components/ui/List";
import { Drawer } from "@/components/ui/Overlay";
import { StepperRow } from "@/components/ui/Stepper";
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
  const usual = product.preferredVendorId ? state.vendors.find((v) => v.id === product.preferredVendorId) : undefined;

  return (
    <>
      <Drawer
        open={!!product}
        onClose={onClose}
        title={product.name}
        subtitle={`${product.packSize} · compared per ${product.baseUnit}`}
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
              Edit
            </Button>
          </>
        }
      >
        <div className="divide-y divide-border border-b border-border">
          <StepperRow
            label="On hand"
            hint={`Next order: ${fmtNum(suggestedQty(product))} ${unit}`}
            value={product.onHand}
            onChange={(v) => actions.setOnHand(product.id, v)}
          />
          <StepperRow label="Par" hint="What you want after a delivery" value={product.parLevel} onChange={(v) => actions.setPar(product.id, v)} />
        </div>
        {usual || product.archived || product.notes ? (
          <div className="mt-3 space-y-1 text-sm text-text-2">
            {usual ? <p>Usual vendor: {usual.name}</p> : null}
            {product.archived ? <p>Archived</p> : null}
            {product.notes ? <p>{product.notes}</p> : null}
          </div>
        ) : null}

        <Section title="Price at each vendor" className="mt-6">
          {quotes.length === 0 ? (
            <p className="py-3 text-[15px] text-muted">No vendor has a price for this yet. It gets one when you approve an invoice that includes it.</p>
          ) : (
            <List>
              {quotes.map((q) => {
                const isBest = q.vendorId === best?.vendorId;
                return (
                  <li key={q.vendorId}>
                    <Row
                      title={
                        <>
                          {q.vendor.name}
                          {isBest && quotes.length > 1 ? (
                            <Badge tone="success" className="ml-2">
                              Cheapest
                            </Badge>
                          ) : null}
                        </>
                      }
                      subtitle={`${q.packSize}${q.sku ? ` · #${q.sku}` : ""} · ${q.source === "invoice" ? `invoice ${fmtDate(q.lastInvoiceDate)}` : "price sheet"}`}
                      value={money(q.landedPrice)}
                      detail={q.landedPrice !== q.price ? `${money(q.price)} + fee` : undefined}
                    />
                  </li>
                );
              })}
            </List>
          )}
          {spread ? (
            <p className="border-t border-border pt-2 text-[13px] text-muted">
              The priciest vendor charges {money(spread.high - spread.low)} more per {unit} ({pct(spread.spreadPct, 0)}).
            </p>
          ) : null}
        </Section>

        <Section title="Price history" className="mt-6">
          {history.length === 0 ? (
            <p className="py-3 text-[15px] text-muted">No recorded invoice prices yet.</p>
          ) : (
            <List>
              {history.map((h) => {
                const vendor = state.vendors.find((v) => v.id === h.vendorId);
                const delta = h.previousPrice ? (h.price - h.previousPrice) / h.previousPrice : 0;
                return (
                  <li key={h.id}>
                    <Row
                      title={vendor?.shortName ?? h.vendorId}
                      subtitle={fmtDate(h.date)}
                      value={`${money(h.price)}/${unitLabel(h.priceUnit)}`}
                      detail={
                        h.previousPrice !== undefined && Math.abs(delta) > 0.005 ? (
                          <span className={delta > 0 ? "text-danger" : "text-success"}>{signedPct(delta)}</span>
                        ) : undefined
                      }
                    />
                  </li>
                );
              })}
            </List>
          )}
        </Section>
      </Drawer>
      <ProductFormModal open={editing} onClose={() => setEditing(false)} product={product} />
    </>
  );
}
