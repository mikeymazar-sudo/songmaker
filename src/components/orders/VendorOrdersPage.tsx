"use client";

import { Check, ChevronDown, ChevronRight, ClipboardCheck, Copy, Printer, Send, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { KpiTile } from "@/components/ui/KpiTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { VendorBadge, VendorDot } from "@/components/ui/VendorBadge";
import type { VendorId } from "@/data/types";
import { cn, fmtDate, fmtDateTime, fmtNum, money, round2, unitLabel } from "@/lib/format";
import type { PurchaseOrder, RoutedLine, VendorCart } from "@/lib/models";
import { bestQuote, buildOrderText, routeOrder } from "@/lib/pricing";
import { useActions, useApp } from "@/lib/store";

export function VendorOrdersPage() {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const routing = useMemo(() => routeOrder(state), [state]);

  const approveAll = () => {
    actions.approvePO("all");
    toast({ title: `${routing.carts.length} purchase orders approved`, description: "Nothing is sent automatically. Copy each order into the vendor portal or text it to your rep." });
  };

  return (
    <>
      <PageHeader
        title="Vendor Recommendations & Purchase Orders"
        description="Your order split by the vendor that wins each item on landed cost: price plus delivery fees, fuel surcharges and sales tax. Override any line, then approve."
        actions={
          routing.carts.length > 0 ? (
            <Button icon={<ClipboardCheck className="h-4 w-4" />} onClick={approveAll}>
              Approve all {routing.carts.length} orders
            </Button>
          ) : null
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SegmentedControl
              value={state.routing.mode}
              onChange={(mode) => actions.setRouting({ mode })}
              options={[
                { value: "smart", label: "Smart routing" },
                { value: "single", label: "Single vendor" },
              ]}
            />
            {state.routing.mode === "single" ? (
              <Select
                value={state.routing.singleVendorId}
                onChange={(e) => actions.setRouting({ singleVendorId: e.target.value as VendorId })}
                className="sm:w-56"
                aria-label="Vendor for the whole order"
              >
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <p className="text-sm text-muted">
            {state.routing.mode === "smart"
              ? "Each item goes to its cheapest landed vendor; items a vendor doesn't carry stay with the best alternative."
              : "Everything that this vendor carries goes to them; the rest falls back to the cheapest alternative."}
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiTile label="Routed total" value={money(routing.total)} tone="brand" hint="incl. fees & est. tax" />
        <KpiTile label="At highest quotes" value={money(routing.unoptimized)} hint="same items, worst vendor" />
        <KpiTile label="Savings this order" value={money(routing.savings)} tone="success" hint={`${money(round2(routing.savings * 52))}/yr if weekly`} />
        <KpiTile label="Units" value={fmtNum(routing.units)} hint={`${routing.lines.length} line items`} />
        <KpiTile label="Vendors" value={routing.vendorsActive} hint={routing.carts.map((c) => c.vendor.shortName).join(" · ") || "—"} />
      </div>

      {routing.missingQuotes.length > 0 ? (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          {routing.missingQuotes.length} item{routing.missingQuotes.length === 1 ? " is" : "s are"} below par but have no vendor price yet:{" "}
          {routing.missingQuotes.map((p) => p.name).join(", ")}. Approve an invoice that includes them, or add a vendor price on the product.
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {routing.carts.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-8 w-8" />}
            title="Nothing to order right now"
            description="Every item is at or above par. Do a walk-in count to build this week's order."
            action={
              <Link href="/order">
                <Button>Start walk-in count</Button>
              </Link>
            }
          />
        ) : (
          routing.carts.map((cart) => <VendorCartCard key={cart.vendor.id} cart={cart} />)
        )}
      </div>

      <PurchaseOrderHistory orders={state.purchaseOrders} />
    </>
  );
}

function VendorCartCard({ cart }: { cart: VendorCart }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const feeLabels = cart.vendor.fees.map((f) => f.label).join(" + ");

  const copy = async () => {
    const text = buildOrderText(cart, state.restaurantName, fmtDate(new Date().toISOString().slice(0, 10)));
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${cart.vendor.name} order copied`, description: "Paste it into the vendor portal or a text to your rep." });
    } catch {
      toast({ title: "Couldn't access the clipboard", description: "Select the order text manually instead.", tone: "danger" });
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <VendorDot vendor={cart.vendor} className="h-3 w-3" />
            {cart.vendor.name}
          </span>
        }
        subtitle={`${cart.vendor.terms} · ${cart.vendor.orderingMethod} · ${cart.lines.length} items · ${fmtNum(cart.units)} units`}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={copy}>
              Copy order
            </Button>
            <Button
              size="sm"
              icon={<Check className="h-4 w-4" />}
              onClick={() => {
                actions.approvePO([cart.vendor.id]);
                toast({ title: `${cart.vendor.shortName} purchase order approved`, description: `${money(cart.total)} · ${cart.lines.length} lines. Not sent; copy it to the vendor when ready.` });
              }}
            >
              Approve PO
            </Button>
          </div>
        }
      />
      <CardBody className="px-0 pb-0">
        <TableWrap className="rounded-none border-x-0 border-b-0">
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th className="hidden xl:table-cell">Vendor SKU</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Unit price</Th>
                <Th align="right">Line total</Th>
                <Th>Route to</Th>
                <Th align="right">Saves</Th>
              </tr>
            </thead>
            <tbody>
              {cart.lines.map((l) => (
                <CartLineRow key={l.product.id} line={l} />
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <div className="grid gap-x-8 gap-y-1 px-5 py-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <Row label="Merchandise" value={money(cart.merchandise)} />
            {cart.percentFees > 0 ? <Row label={feeLabels} value={money(cart.percentFees)} /> : null}
            {cart.flatFees > 0 ? <Row label={feeLabels} value={money(cart.flatFees)} /> : null}
            {cart.tax > 0 ? <Row label={`Est. sales tax (${Math.round(cart.vendor.salesTaxRate * 100)}% on taxable items)`} value={money(cart.tax)} /> : null}
          </div>
          <div className="flex flex-col justify-end sm:items-end">
            <div className="text-xs uppercase tracking-wide text-muted">Estimated total</div>
            <div className="tabular text-2xl font-semibold text-text">{money(cart.total)}</div>
            {cart.savings > 0 ? (
              <div className="text-xs text-success">
                {money(cart.savings)} below the highest competing quotes ({money(cart.unoptimized)})
              </div>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="tabular font-medium text-text">{value}</span>
    </div>
  );
}

function CartLineRow({ line }: { line: RoutedLine }) {
  const actions = useActions();
  const best = bestQuote(line.quotes, line.product.preferredVendorId);
  const unit = unitLabel(line.product.baseUnit);
  return (
    <tr className={cn(line.overridden && "bg-warning-soft/40")}>
      <Td className="whitespace-normal">
        <div className="font-medium text-text">{line.product.name}</div>
        <div className="text-xs text-muted">
          {line.quote.packSize} · {line.product.category}
          <span className="xl:hidden"> · <span className="font-mono">{line.quote.sku}</span></span>
        </div>
      </Td>
      <Td className="hidden font-mono text-xs text-muted xl:table-cell">{line.quote.sku}</Td>
      <Td align="right">
        {fmtNum(line.qty)} {unit}
      </Td>
      <Td align="right">
        {money(line.quote.price)}
        {line.percentFee > 0 ? <div className="text-[11px] text-muted">+{money(round2(line.percentFee / line.qty))} fee</div> : null}
      </Td>
      <Td align="right" className="font-medium">
        {money(line.merchandise)}
      </Td>
      <Td>
        <Select
          value={line.overridden ? line.vendorId : ""}
          onChange={(e) => actions.setLineVendor(line.product.id, e.target.value ? (e.target.value as VendorId) : null)}
          className="h-9 w-40 text-xs"
          aria-label={`Vendor for ${line.product.name}`}
        >
          <option value="">Auto · {best?.vendor.shortName} {best ? money(best.landedPrice) : ""}</option>
          {line.quotes.map((q) => (
            <option key={q.vendorId} value={q.vendorId}>
              {q.vendor.shortName} · {money(q.landedPrice)}/{unit}
              {q.vendorId === best?.vendorId ? " (best)" : ""}
            </option>
          ))}
        </Select>
      </Td>
      <Td align="right">
        {line.savings > 0 ? (
          <Badge tone="success">{money(line.savings)}</Badge>
        ) : line.quotes.length < 2 ? (
          <span className="text-xs text-muted">only vendor</span>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </Td>
    </tr>
  );
}

function PurchaseOrderHistory({ orders }: { orders: PurchaseOrder[] }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const [open, setOpen] = useState<string | null>(null);

  if (orders.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader title="Purchase orders" subtitle="Approved orders, newest first. Mark an order as sent once it's in the vendor's hands." />
      <CardBody className="space-y-2">
        {orders.map((po) => {
          const vendor = state.vendors.find((v) => v.id === po.vendorId);
          const isOpen = open === po.id;
          return (
            <div key={po.id} className="rounded-xl border border-border">
              <button type="button" onClick={() => setOpen(isOpen ? null : po.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text">{po.number}</span>
                    {vendor ? <VendorBadge vendor={vendor} /> : null}
                    <Badge tone={po.status === "sent" ? "success" : "info"}>{po.status === "sent" ? "Sent" : "Approved"}</Badge>
                  </div>
                  <div className="text-xs text-muted">
                    {fmtDateTime(po.createdAt)} · {po.lines.length} lines
                    {po.savings > 0 ? ` · saved ${money(po.savings)}` : ""}
                  </div>
                </div>
                <div className="tabular font-semibold text-text">{money(po.total)}</div>
              </button>
              {isOpen ? (
                <div className="border-t border-border px-4 py-3">
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Item</Th>
                          <Th>SKU</Th>
                          <Th align="right">Qty</Th>
                          <Th align="right">Unit</Th>
                          <Th align="right">Total</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.lines.map((l) => (
                          <tr key={l.productId}>
                            <Td className="whitespace-normal">
                              {l.name}
                              <div className="text-xs text-muted">{l.packSize}</div>
                            </Td>
                            <Td className="font-mono text-xs text-muted">{l.sku}</Td>
                            <Td align="right">
                              {fmtNum(l.qty)} {unitLabel(l.unit)}
                            </Td>
                            <Td align="right">{money(l.unitPrice)}</Td>
                            <Td align="right">{money(l.total)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-muted">
                      Merchandise {money(po.merchandise)} · fees {money(po.fees)} · tax {money(po.tax)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Copy className="h-4 w-4" />}
                        onClick={async () => {
                          const text = [
                            `${state.restaurantName} — ${po.number} for ${vendor?.name ?? po.vendorId}`,
                            ...po.lines.map((l) => `${fmtNum(l.qty)} ${unitLabel(l.unit)}  ${l.name}  [${l.sku}]  @ ${money(l.unitPrice)} = ${money(l.total)}`),
                            `Estimated total: ${money(po.total)}`,
                          ].join("\n");
                          try {
                            await navigator.clipboard.writeText(text);
                            toast({ title: `${po.number} copied` });
                          } catch {
                            toast({ title: "Clipboard unavailable", tone: "danger" });
                          }
                        }}
                      >
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                        Print
                      </Button>
                      {po.status === "approved" ? (
                        <Button size="sm" icon={<Send className="h-4 w-4" />} onClick={() => actions.setPOStatus(po.id, "sent")}>
                          Mark as sent
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => actions.setPOStatus(po.id, "approved")}>
                          Undo sent
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
