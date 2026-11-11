"use client";

import { ChevronDown, Copy, Mail, MessageSquare, Printer, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles, type ButtonSize } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { Hero } from "@/components/ui/Hero";
import { List, Section } from "@/components/ui/List";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import type { VendorId } from "@/data/types";
import { cn, fmtDate, fmtDateTime, fmtNum, money, moneyWhole, round2, unitLabel } from "@/lib/format";
import type { PurchaseOrder, RoutedLine, VendorCart } from "@/lib/models";
import { bestQuote, buildOrderMessage, buildOrderText, emailHref, routeOrder, smsHref, BUSINESS_NAME } from "@/lib/pricing";
import { useActions, useApp } from "@/lib/store";

export function VendorOrdersPage() {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const routing = useMemo(() => routeOrder(state), [state]);
  const hasOrder = routing.carts.length > 0;

  const approveAll = () => {
    actions.approvePO("all");
    toast({
      title: `${routing.carts.length} orders approved`,
      description: "Nothing was sent. Text, email or copy each order when you're ready.",
    });
  };

  return (
    <>
      {hasOrder ? (
        <>
          <Hero
            label="This week's order"
            value={money(routing.total)}
            hint={
              <>
                {fmtNum(routing.units)} unit{routing.units === 1 ? "" : "s"} from {routing.vendorsActive} vendor{routing.vendorsActive === 1 ? "" : "s"}, fees and tax included
                {routing.savings > 0 ? (
                  <>
                    <br />
                    <span className="font-medium text-success">
                      Saves {money(routing.savings)}, about {moneyWhole(routing.savings * 52)} a year
                    </span>
                  </>
                ) : null}
              </>
            }
          />
          {routing.carts.length > 1 ? (
            <Button className="mt-6 w-full md:w-auto" onClick={approveAll}>
              Approve all {routing.carts.length}
            </Button>
          ) : null}
          <p className="mt-3 text-[13px] text-muted">Nothing is sent to a vendor automatically.</p>

          <Tabs
            className="mt-8"
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
              className="mt-3 md:w-72"
              aria-label="Vendor for the whole order"
            >
              {state.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          ) : null}
        </>
      ) : (
        <PageHeader title="Order" />
      )}

      {routing.missingQuotes.length > 0 ? (
        <p className="mt-4 text-[15px] leading-relaxed text-text-2">
          <span className="font-medium text-warning">
            {routing.missingQuotes.length} item{routing.missingQuotes.length === 1 ? " needs" : "s need"} a price:
          </span>{" "}
          {routing.missingQuotes.map((p) => p.name).join(", ")}.
        </p>
      ) : null}

      {hasOrder ? (
        <List>
          {routing.carts.map((cart) => (
            <VendorCartRow key={cart.vendor.id} cart={cart} />
          ))}
        </List>
      ) : (
        <EmptyState
          title="Nothing to order"
          description="Every item is at or above par."
          action={
            <Link href="/order" className={buttonStyles("primary")}>
              Start count
            </Link>
          }
        />
      )}

      <ApprovedOrders orders={state.purchaseOrders} />
    </>
  );
}

/** Opens the phone's own messages or mail app with the order filled in. Nothing goes out until the owner presses send. */
function TextEmailButtons({ vendorName, message, size = "md" }: { vendorName: string; message: string; size?: ButtonSize }) {
  return (
    <>
      <a href={smsHref(message)} className={buttonStyles("outline", size)}>
        <MessageSquare className="h-4 w-4" />
        Text
      </a>
      <a href={emailHref(`${BUSINESS_NAME} order for ${vendorName}`, message)} className={buttonStyles("outline", size)}>
        <Mail className="h-4 w-4" />
        Email
      </a>
    </>
  );
}

function VendorCartRow({ cart }: { cart: VendorCart }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const feeLabel = cart.vendor.fees.map((f) => f.label).join(" + ") || "Fees";
  const dateLabel = fmtDate(new Date().toISOString().slice(0, 10));
  const message = buildOrderMessage(
    cart.vendor.name,
    dateLabel,
    cart.lines.map((l) => ({ qty: l.qty, unit: l.product.baseUnit, name: l.product.name, sku: l.quote.sku, packSize: l.quote.packSize })),
  );

  const copy = async () => {
    const text = buildOrderText(cart, state.restaurantName, dateLabel);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${cart.vendor.shortName} order copied`, description: "Paste it into their website or a text to your rep." });
    } catch {
      toast({ title: "Couldn't copy", description: "Your browser blocked the clipboard. Try again.", tone: "danger" });
    }
  };

  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 py-3 text-left active:opacity-60">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-medium tracking-tight text-text">{cart.vendor.name}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            {cart.lines.length} item{cart.lines.length === 1 ? "" : "s"} · {fmtNum(cart.units)} unit{cart.units === 1 ? "" : "s"}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-[17px] font-semibold tracking-tight text-text">{money(cart.total)}</div>
          {cart.savings > 0 ? <div className="tabular mt-0.5 text-[13px] text-success">saves {money(cart.savings)}</div> : null}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="pb-5">
          <p className="text-[13px] text-muted">
            Order via {cart.vendor.orderingMethod} · Pay: {cart.vendor.terms}
          </p>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {cart.lines.map((l) => (
              <CartLine key={l.product.id} line={l} />
            ))}
          </ul>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm md:max-w-sm md:ml-auto">
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
                <dt className="text-muted">Est. tax ({Math.round(cart.vendor.salesTaxRate * 100)}% on some items)</dt>
                <dd className="tabular text-right text-text">{money(cart.tax)}</dd>
              </>
            ) : null}
            <dt className="font-medium text-text">Total</dt>
            <dd className="tabular text-right font-semibold text-text">{money(cart.total)}</dd>
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:flex md:justify-end">
            <TextEmailButtons vendorName={cart.vendor.name} message={message} />
            <Button variant="outline" icon={<Copy className="h-4 w-4" />} onClick={copy}>
              Copy
            </Button>
            <Button
              onClick={() => {
                actions.approvePO([cart.vendor.id]);
                toast({
                  title: `${cart.vendor.shortName} order approved`,
                  description: `${money(cart.total)}, ${cart.lines.length} items. Not sent yet. Text, email or copy it to ${cart.vendor.shortName} when you're ready.`,
                });
              }}
            >
              Approve
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function CartLine({ line }: { line: RoutedLine }) {
  const actions = useActions();
  const best = bestQuote(line.quotes, line.product.preferredVendorId);
  const unit = unitLabel(line.product.baseUnit);
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[15px] font-medium leading-snug text-text">{line.product.name}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            {fmtNum(line.qty)} {unit} × {money(line.quote.price)}
            {line.percentFee > 0 ? ` + ${money(round2(line.percentFee / line.qty))} fee` : ""}
            {line.quote.sku ? ` · #${line.quote.sku}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-[15px] font-medium text-text">{money(line.merchandise)}</div>
          {line.savings > 0 ? <div className="tabular mt-0.5 text-[13px] text-success">saves {money(line.savings)}</div> : null}
        </div>
      </div>
      {line.quotes.length > 1 ? (
        <div className="mt-1 flex items-center gap-3">
          <Select
            value={line.overridden ? line.vendorId : ""}
            onChange={(e) => actions.setLineVendor(line.product.id, e.target.value ? (e.target.value as VendorId) : null)}
            className="h-8! w-auto! max-w-full rounded-none! border-0! bg-transparent pl-0! pr-7 text-sm text-text-2"
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
          {line.overridden ? <Badge tone="warning">You picked</Badge> : null}
        </div>
      ) : null}
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
    <Section title="Approved orders">
      <List>
        {orders.map((po) => {
          const vendor = state.vendors.find((v) => v.id === po.vendorId);
          const isOpen = open === po.id;
          return (
            <li key={po.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : po.id)}
                aria-expanded={isOpen}
                className="flex min-h-14 w-full items-center gap-3 py-3 text-left active:opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-text">{vendor?.name ?? po.vendorId}</div>
                  <div className="mt-0.5 truncate text-[13px] text-muted">
                    {fmtDateTime(po.createdAt)} · {po.lines.length} items
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular text-[15px] font-medium text-text">{money(po.total)}</div>
                  <Badge tone={po.status === "sent" ? "success" : "neutral"}>{po.status === "sent" ? "Sent" : "Not sent"}</Badge>
                </div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen ? (
                <div className="pb-4">
                  <p className="text-[13px] text-muted">
                    {po.number} · Items {money(po.merchandise)} · fees {money(po.fees)} · tax {money(po.tax)}
                    {po.savings > 0 ? ` · saved ${money(po.savings)}` : ""}
                  </p>
                  <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
                    {po.lines.map((l) => (
                      <li key={l.productId} className="flex items-start justify-between gap-4 py-2.5">
                        <div className="min-w-0">
                          <div className="text-text">{l.name}</div>
                          <div className="text-[13px] text-muted">
                            {fmtNum(l.qty)} {unitLabel(l.unit)} × {money(l.unitPrice)}
                            {l.sku ? ` · #${l.sku}` : ""}
                          </div>
                        </div>
                        <div className="tabular shrink-0 text-text">{money(l.total)}</div>
                      </li>
                    ))}
                  </ul>
                  <div className="no-print mt-3 flex flex-wrap gap-2 md:justify-end">
                    <TextEmailButtons
                      vendorName={vendor?.name ?? po.vendorId}
                      message={buildOrderMessage(vendor?.name ?? po.vendorId, fmtDate(po.createdAt), po.lines)}
                      size="sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={async () => {
                        const text = [
                          `${state.restaurantName} — ${po.number} for ${vendor?.name ?? po.vendorId}`,
                          ...po.lines.map(
                            (l) => `${fmtNum(l.qty)} ${unitLabel(l.unit)}  ${l.name}  [${l.sku}]  @ ${money(l.unitPrice)} = ${money(l.total)}`,
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
              ) : null}
            </li>
          );
        })}
      </List>
    </Section>
  );
}
