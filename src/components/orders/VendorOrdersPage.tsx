"use client";

import { Check, ChevronDown, ClipboardCheck, Copy, Printer, Send, TriangleAlert, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { VendorBadge, VendorDot } from "@/components/ui/VendorBadge";
import type { VendorId } from "@/data/types";
import { cn, fmtDate, fmtDateTime, fmtNum, money, moneyWhole, round2, unitLabel } from "@/lib/format";
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
    toast({
      title: `${routing.carts.length} orders approved`,
      description: "Nothing was sent. Copy each order into the vendor's site or text it to your rep.",
    });
  };

  return (
    <>
      <PageHeader
        title="This week's order"
        description="We picked the cheapest vendor for every item, counting delivery fees, fuel charges and tax. Look it over, then approve each vendor's order. Nothing is sent automatically."
        actions={
          routing.carts.length > 1 ? (
            <Button icon={<ClipboardCheck className="h-4 w-4" />} onClick={approveAll}>
              Approve all {routing.carts.length}
            </Button>
          ) : null
        }
      />

      {routing.carts.length > 0 ? (
        <Card className="mb-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-(--radius-card) bg-border sm:grid-cols-3">
            <Summary label="Order total" value={money(routing.total)} hint="Including fees and estimated tax" />
            <Summary
              label="You save"
              value={money(routing.savings)}
              hint={`vs. buying each item from the priciest vendor · about ${moneyWhole(routing.savings * 52)} a year`}
              tone="success"
            />
            <Summary
              className="col-span-2 sm:col-span-1"
              label="What's in it"
              value={`${fmtNum(routing.units)} units`}
              hint={`${routing.lines.length} items from ${routing.vendorsActive} vendor${routing.vendorsActive === 1 ? "" : "s"}`}
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[15px] font-medium text-text">How to split the order</div>
              <p className="text-[13px] text-muted">
                {state.routing.mode === "smart"
                  ? "Each item goes to the vendor where it costs least."
                  : "Everything this vendor carries goes to them. The rest goes to the cheapest other vendor."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SegmentedControl
                value={state.routing.mode}
                onChange={(mode) => actions.setRouting({ mode })}
                options={[
                  { value: "smart", label: "Cheapest for each item" },
                  { value: "single", label: "One vendor" },
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
          </div>
        </Card>
      ) : null}

      {routing.missingQuotes.length > 0 ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">
              {routing.missingQuotes.length} item{routing.missingQuotes.length === 1 ? " needs" : "s need"} a price first:
            </span>{" "}
            {routing.missingQuotes.map((p) => p.name).join(", ")}. Approve an invoice that includes{" "}
            {routing.missingQuotes.length === 1 ? "it" : "them"}, and it&apos;ll be added to the order.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {routing.carts.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="Nothing to order right now"
            description="Every item is at or above par. Count your stock to build this week's order."
            action={
              <Link href="/order">
                <Button>Count stock</Button>
              </Link>
            }
          />
        ) : (
          routing.carts.map((cart) => <VendorCartCard key={cart.vendor.id} cart={cart} />)
        )}
      </div>

      <ApprovedOrders orders={state.purchaseOrders} />
    </>
  );
}

function Summary({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success";
  className?: string;
}) {
  return (
    <div className={cn("bg-surface px-4 py-4 sm:px-5", className)}>
      <div className="text-sm font-medium text-text-2">{label}</div>
      <div
        className={cn(
          "tabular mt-1.5 text-[24px] font-semibold leading-none tracking-tight sm:text-[28px]",
          tone === "success" ? "text-success" : "text-text",
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-[13px] leading-snug text-muted">{hint}</div>
    </div>
  );
}

function VendorCartCard({ cart }: { cart: VendorCart }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const feeLabel = cart.vendor.fees.map((f) => f.label).join(" + ") || "Fees";
  const preview = cart.lines.slice(0, 3).map((l) => l.product.name);
  const more = cart.lines.length - preview.length;

  const copy = async () => {
    const text = buildOrderText(cart, state.restaurantName, fmtDate(new Date().toISOString().slice(0, 10)));
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${cart.vendor.shortName} order copied`, description: "Paste it into their website or a text to your rep." });
    } catch {
      toast({ title: "Couldn't copy", description: "Your browser blocked the clipboard. Try again.", tone: "danger" });
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 px-5 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-text">
            <VendorDot vendor={cart.vendor} className="h-3 w-3" />
            {cart.vendor.name}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Order via {cart.vendor.orderingMethod} · Pay: {cart.vendor.terms}
          </p>
        </div>
        <div className="sm:text-right">
          <div className="tabular text-[26px] font-semibold leading-none tracking-tight text-text">{money(cart.total)}</div>
          <div className="mt-1.5 text-[13px] text-muted">
            {cart.lines.length} items · {fmtNum(cart.units)} units
            {cart.savings > 0 ? <span className="text-success"> · saves {money(cart.savings)}</span> : null}
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2"
        >
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
          <span className="min-w-0 flex-1 truncate text-[15px] text-text-2">
            {open ? (
              "Hide items"
            ) : (
              <>
                <span className="font-medium text-text">See all {cart.lines.length} items</span>
                <span className="text-muted">
                  {" "}
                  · {preview.join(", ")}
                  {more > 0 ? `, +${more} more` : ""}
                </span>
              </>
            )}
          </span>
        </button>
        {open ? (
          <ul className="divide-y divide-border border-t border-border">
            {cart.lines.map((l) => (
              <CartLine key={l.product.id} line={l} />
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 border-t border-border bg-surface-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted">Items</dt>
          <dd className="tabular text-right text-text">{money(cart.merchandise)}</dd>
          {cart.percentFees > 0 ? (
            <>
              <dt className="text-muted">{feeLabel}</dt>
              <dd className="tabular text-right text-text">{money(cart.percentFees)}</dd>
            </>
          ) : null}
          {cart.flatFees > 0 ? (
            <>
              <dt className="text-muted">{feeLabel}</dt>
              <dd className="tabular text-right text-text">{money(cart.flatFees)}</dd>
            </>
          ) : null}
          {cart.tax > 0 ? (
            <>
              <dt className="text-muted">Est. sales tax ({Math.round(cart.vendor.salesTaxRate * 100)}% on some items)</dt>
              <dd className="tabular text-right text-text">{money(cart.tax)}</dd>
            </>
          ) : null}
          <dt className="font-medium text-text">Total</dt>
          <dd className="tabular text-right font-semibold text-text">{money(cart.total)}</dd>
        </dl>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" icon={<Copy className="h-4 w-4" />} onClick={copy}>
            Copy order
          </Button>
          <Button
            icon={<Check className="h-4 w-4" />}
            onClick={() => {
              actions.approvePO([cart.vendor.id]);
              toast({
                title: `${cart.vendor.shortName} order approved`,
                description: `${money(cart.total)} · ${cart.lines.length} items. Not sent yet; copy it to ${cart.vendor.shortName} when you're ready.`,
              });
            }}
          >
            Approve order
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CartLine({ line }: { line: RoutedLine }) {
  const actions = useActions();
  const best = bestQuote(line.quotes, line.product.preferredVendorId);
  const unit = unitLabel(line.product.baseUnit);
  return (
    <li className={cn("px-5 py-3.5", line.overridden && "bg-warning-soft/40")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-text">{line.product.name}</div>
          <div className="text-[13px] text-muted">
            {line.quote.packSize}
            {line.quote.sku ? <span> · Item # {line.quote.sku}</span> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-[15px] font-semibold text-text">{money(line.merchandise)}</div>
          <div className="tabular text-[13px] text-muted">
            {fmtNum(line.qty)} {unit} × {money(line.quote.price)}
            {line.percentFee > 0 ? ` + ${money(round2(line.percentFee / line.qty))} fee` : ""}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {line.quotes.length > 1 ? (
          <label className="flex items-center gap-2 whitespace-nowrap text-[13px] text-muted">
            Buy from
            <Select
              value={line.overridden ? line.vendorId : ""}
              onChange={(e) => actions.setLineVendor(line.product.id, e.target.value ? (e.target.value as VendorId) : null)}
              className="h-9! w-auto! min-w-52 text-sm"
              aria-label={`Vendor for ${line.product.name}`}
            >
              <option value="">
                Cheapest: {best?.vendor.shortName} {best ? `${money(best.landedPrice)}/${unit}` : ""}
              </option>
              {line.quotes.map((q) => (
                <option key={q.vendorId} value={q.vendorId}>
                  {q.vendor.shortName} · {money(q.landedPrice)}/{unit}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <span className="text-[13px] text-muted">Only {line.quote.vendor.shortName} carries this</span>
        )}
        {line.savings > 0 ? <Badge tone="success">saves {money(line.savings)}</Badge> : null}
        {line.overridden ? <Badge tone="warning">You picked this vendor</Badge> : null}
      </div>
    </li>
  );
}

function ApprovedOrders({ orders }: { orders: PurchaseOrder[] }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const [open, setOpen] = useState<string | null>(null);

  if (orders.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardHeader title="Approved orders" subtitle="Newest first. Mark an order as sent once the vendor has it." />
      <CardBody className="space-y-2">
        {orders.map((po) => {
          const vendor = state.vendors.find((v) => v.id === po.vendorId);
          const isOpen = open === po.id;
          return (
            <div key={po.id} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : po.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-surface-2"
              >
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {vendor ? <VendorBadge vendor={vendor} tone="plain" /> : null}
                    <Badge tone={po.status === "sent" ? "success" : "info"}>{po.status === "sent" ? "Sent" : "Approved, not sent"}</Badge>
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    {po.number} · {fmtDateTime(po.createdAt)} · {po.lines.length} items
                    {po.savings > 0 ? ` · saved ${money(po.savings)}` : ""}
                  </div>
                </div>
                <div className="tabular text-[15px] font-semibold text-text">{money(po.total)}</div>
              </button>
              {isOpen ? (
                <div className="border-t border-border px-4 py-3">
                  <ul className="divide-y divide-border text-sm">
                    {po.lines.map((l) => (
                      <li key={l.productId} className="flex items-start justify-between gap-4 py-2">
                        <div className="min-w-0">
                          <div className="text-text">{l.name}</div>
                          <div className="text-[13px] text-muted">
                            {l.packSize}
                            {l.sku ? ` · Item # ${l.sku}` : ""}
                          </div>
                        </div>
                        <div className="tabular shrink-0 text-right">
                          <div className="text-text">{money(l.total)}</div>
                          <div className="text-[13px] text-muted">
                            {fmtNum(l.qty)} {unitLabel(l.unit)} × {money(l.unitPrice)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="text-[13px] text-muted">
                      Items {money(po.merchandise)} · fees {money(po.fees)} · tax {money(po.tax)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Copy className="h-4 w-4" />}
                        onClick={async () => {
                          const text = [
                            `${state.restaurantName} — ${po.number} for ${vendor?.name ?? po.vendorId}`,
                            ...po.lines.map(
                              (l) =>
                                `${fmtNum(l.qty)} ${unitLabel(l.unit)}  ${l.name}  [${l.sku}]  @ ${money(l.unitPrice)} = ${money(l.total)}`,
                            ),
                            `Estimated total: ${money(po.total)}`,
                          ].join("\n");
                          try {
                            await navigator.clipboard.writeText(text);
                            toast({ title: `${po.number} copied` });
                          } catch {
                            toast({ title: "Couldn't copy", description: "Your browser blocked the clipboard.", tone: "danger" });
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
                          Not sent after all
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
