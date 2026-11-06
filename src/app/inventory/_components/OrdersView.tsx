"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  Info,
  Mail,
  MessageSquare,
  PackageCheck,
  Phone,
  Plus,
  Send,
  Trash2,
  Truck,
} from "lucide-react";
import {
  type Item,
  type Order,
  type OrderLine,
  type Supplier,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQty,
  nextDelivery,
  orderTotal,
  pluralUnit,
  qtyWithUnit,
  stockStatus,
  suggestedQty,
  timeAgo,
} from "../_lib/data";
import { cancelOrder, receiveOrder, sendOrder, useInventory, useNow } from "../_lib/store";
import {
  Button,
  ButtonLink,
  Card,
  Dialog,
  EmptyState,
  PageHeader,
  Segmented,
  Select,
  StatusBadge,
  Stepper,
  cx,
  inputClass,
  parseQty,
} from "./ui";

type Tab = "suggested" | "incoming" | "past";

export function OrdersView({ initialTab }: { initialTab: Tab }) {
  const inv = useInventory();
  const now = useNow();
  const [tab, setTab] = useState<Tab>(initialTab);

  const groups = useMemo(() => {
    if (!inv) return [];
    const bySupplier = new Map<string, { item: Item; qty: number }[]>();
    for (const item of inv.items) {
      const qty = suggestedQty(item, inv.orders);
      if (qty <= 0) continue;
      const list = bySupplier.get(item.supplierId) ?? [];
      list.push({ item, qty });
      bySupplier.set(item.supplierId, list);
    }
    return [...bySupplier.entries()]
      .map(([supplierId, lines]) => ({
        supplierId,
        supplier: inv.suppliers.find((s) => s.id === supplierId) ?? null,
        lines: lines.sort((a, b) => a.item.name.localeCompare(b.item.name)),
      }))
      .sort((a, b) => {
        // Soonest delivery first, so the order with the closest cutoff is on top.
        if (!a.supplier) return 1;
        if (!b.supplier) return -1;
        const da = nextDelivery(a.supplier, now)?.getTime() ?? Infinity;
        const db = nextDelivery(b.supplier, now)?.getTime() ?? Infinity;
        return da - db || a.supplier.name.localeCompare(b.supplier.name);
      });
  }, [inv, now]);

  if (!inv) return null;

  const incoming = inv.orders.filter((o) => o.status === "sent");
  const past = inv.orders
    .filter((o) => o.status === "received")
    .sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0));
  const suggestedCount = groups.filter((g) => g.supplier).length;

  return (
    <div>
      <PageHeader
        title="Orders"
        description="We add up what you need to get every item back to par. Check the amounts, then send each supplier their order."
      />

      <div className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Segmented
          label="Order lists"
          value={tab}
          onChange={setTab}
          options={[
            { value: "suggested", label: "To order", count: suggestedCount },
            { value: "incoming", label: "On the way", count: incoming.length },
            { value: "past", label: "Received" },
          ]}
        />
      </div>

      {tab === "suggested" &&
        (groups.length === 0 ? (
          <Card>
            <EmptyState icon={Check} title="Nothing to order right now">
              Every item is at par or already on the way. Count your stock regularly so this list stays accurate.
            </EmptyState>
          </Card>
        ) : (
          <div className="space-y-5">
            {groups.map((g) =>
              g.supplier ? (
                <SupplierOrderCard
                  key={g.supplierId}
                  supplier={g.supplier}
                  suggested={g.lines}
                  allItems={inv.items.filter((i) => i.supplierId === g.supplierId)}
                  restaurantName={inv.restaurantName}
                />
              ) : (
                <NoSupplierCard key="none" items={g.lines.map((l) => l.item)} />
              ),
            )}
          </div>
        ))}

      {tab === "incoming" &&
        (incoming.length === 0 ? (
          <Card>
            <EmptyState icon={Truck} title="No deliveries on the way">
              When you send an order, it waits here until the delivery arrives. Then you check it in and it&rsquo;s added
              to your stock.
            </EmptyState>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {incoming.map((o) => (
              <IncomingOrderCard key={o.id} order={o} supplier={inv.suppliers.find((s) => s.id === o.supplierId)} />
            ))}
          </div>
        ))}

      {tab === "past" &&
        (past.length === 0 ? (
          <Card>
            <EmptyState icon={PackageCheck} title="No deliveries yet">
              Deliveries you check in will be listed here.
            </EmptyState>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {past.map((o) => (
                <PastOrderRow key={o.id} order={o} supplier={inv.suppliers.find((s) => s.id === o.supplierId)} />
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SupplierOrderCard({
  supplier,
  suggested,
  allItems,
  restaurantName,
}: {
  supplier: Supplier;
  suggested: { item: Item; qty: number }[];
  allItems: Item[];
  restaurantName: string;
}) {
  const now = useNow();
  // Only amounts the owner changed are kept here; everything else uses the suggestion.
  const [qty, setQty] = useState<Record<string, string>>({});
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const suggestedMap = new Map(suggested.map((s) => [s.item.id, s.qty]));
  const valueOf = (id: string) => qty[id] ?? String(suggestedMap.get(id) ?? 1);
  const [sending, setSending] = useState(false);

  const rows = [
    ...suggested.map((s) => s.item),
    ...extraIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)),
  ];
  const addable = allItems.filter((i) => !rows.some((r) => r.id === i.id));

  const lines: OrderLine[] = rows
    .map((i) => ({
      itemId: i.id,
      name: i.name,
      unit: i.unit,
      packSize: i.packSize,
      qty: Math.max(0, parseQty(valueOf(i.id)) ?? 0),
      cost: i.cost,
    }))
    .filter((l) => l.qty > 0);
  const total = orderTotal({ lines });
  const delivery = nextDelivery(supplier, now);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{supplier.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
            {supplier.contact && <span>{supplier.contact}</span>}
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1 hover:text-stone-900">
                <Phone className="size-3.5" aria-hidden />
                {supplier.phone}
              </a>
            )}
          </p>
        </div>
        {delivery && (
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
            <CalendarDays className="size-4" aria-hidden />
            Next delivery {formatDate(delivery.getTime())}
          </span>
        )}
      </div>
      {supplier.notes && (
        <p className="mx-5 mb-4 flex items-start gap-2 rounded-xl bg-stone-100/80 px-3 py-2 text-sm text-stone-700">
          <Info className="mt-0.5 size-4 shrink-0 text-stone-500" aria-hidden />
          {supplier.notes}
        </p>
      )}

      <div className="hidden grid-cols-[minmax(0,1fr)_9rem_13rem_6rem] gap-4 border-y border-stone-200 bg-stone-50/80 px-5 py-2 text-[13px] font-medium text-stone-500 md:grid">
        <span>Item</span>
        <span>On hand / par</span>
        <span>Order</span>
        <span className="text-right">Cost</span>
      </div>
      <ul className="divide-y divide-stone-100 border-t border-stone-100 md:border-t-0">
        {rows.map((item) => {
          const n = parseQty(valueOf(item.id)) ?? 0;
          return (
            <li
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_9rem_13rem_6rem]"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{item.name}</p>
                <p className="truncate text-[13px] text-stone-500">
                  {item.packSize ? `${item.unit} of ${item.packSize}` : `per ${item.unit}`} ·{" "}
                  {formatMoney(item.cost)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-stone-600 tabular-nums md:block">
                <span className="md:block">
                  {formatQty(item.onHand)} / {formatQty(item.par)}
                </span>
                <span className="md:mt-1 md:block">
                  <StatusBadge status={stockStatus(item)} short />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Stepper
                  label={`${item.name} order amount`}
                  value={valueOf(item.id)}
                  onChange={(v) => setQty((q) => ({ ...q, [item.id]: v }))}
                  placeholder="0"
                />
                <span className="text-sm text-stone-500">{pluralUnit(item.unit, n)}</span>
              </div>
              <p className="text-right text-[15px] font-medium tabular-nums">{formatMoney(n * item.cost)}</p>
            </li>
          );
        })}
      </ul>

      {addable.length > 0 && (
        <div className="border-t border-stone-100 px-5 py-3">
          <Select
            aria-label={`Add another item from ${supplier.name}`}
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              setExtraIds((x) => [...x, id]);
            }}
            className="max-w-xs"
          >
            <option value="">+ Add another item</option>
            {addable.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} (have {qtyWithUnit(i.onHand, i.unit)})
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] text-stone-600">
          {lines.length} item{lines.length === 1 ? "" : "s"} · Total{" "}
          <span className="text-lg font-semibold text-stone-900 tabular-nums">{formatMoney(total)}</span>
        </p>
        <Button icon={Send} disabled={lines.length === 0} onClick={() => setSending(true)}>
          Send order
        </Button>
      </div>

      <SendOrderDialog
        open={sending}
        onClose={() => setSending(false)}
        supplier={supplier}
        lines={lines}
        restaurantName={restaurantName}
        delivery={delivery}
      />
    </Card>
  );
}

function NoSupplierCard({ items }: { items: Item[] }) {
  return (
    <Card className="border-dashed p-5">
      <h2 className="text-lg font-semibold tracking-tight">No supplier set</h2>
      <p className="mt-1 text-sm text-stone-600">
        These items are below par, but we don&rsquo;t know who to order them from. Open each item and pick a supplier.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.id}>
            <ButtonLink href={`/inventory/items?item=${i.id}`} variant="secondary" size="sm">
              {i.name}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function buildMessage(supplier: Supplier, lines: OrderLine[], restaurantName: string, delivery: Date | null) {
  const first = supplier.contact.split(" ")[0];
  const when = delivery ? ` on your next delivery (${formatDate(delivery.getTime())})` : "";
  const list = lines
    .map((l) => `• ${qtyWithUnit(l.qty, l.unit)} ${l.name}${l.packSize ? ` (${l.packSize})` : ""}`)
    .join("\n");
  return `Hi${first ? ` ${first}` : ""},\n\nThis is ${restaurantName}. Could you please send the following${when}?\n\n${list}\n\nThank you!\n${restaurantName}`;
}

function SendOrderDialog({
  open,
  onClose,
  supplier,
  lines,
  restaurantName,
  delivery,
}: {
  open: boolean;
  onClose: () => void;
  supplier: Supplier;
  lines: OrderLine[];
  restaurantName: string;
  delivery: Date | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={`Order for ${supplier.name}`}
      description={`Send this to ${supplier.contact || "your rep"} the way you normally order. Then mark it as sent so it moves to “On the way”.`}
    >
      <SendOrderBody
        supplier={supplier}
        lines={lines}
        initial={buildMessage(supplier, lines, restaurantName, delivery)}
        onSent={() => {
          sendOrder(supplier.id, lines);
          onClose();
        }}
        onCancel={onClose}
      />
    </Dialog>
  );
}

function SendOrderBody({
  supplier,
  lines,
  initial,
  onSent,
  onCancel,
}: {
  supplier: Supplier;
  lines: OrderLine[];
  initial: string;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState(initial);
  const [copied, setCopied] = useState(false);
  const subject = `Order from ${initial.match(/This is (.+?)\./)?.[1] ?? "us"}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Order message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={Math.min(16, 8 + lines.length)}
          className={cx(inputClass, "h-auto resize-y py-3 font-mono text-[13px] leading-relaxed")}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>
          {copied ? "Copied" : "Copy message"}
        </Button>
        {supplier.email && (
          <a
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-stone-800 ring-1 ring-stone-300 ring-inset hover:bg-stone-50",
            )}
            href={`mailto:${supplier.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
          >
            <Mail className="size-4" aria-hidden />
            Email
          </a>
        )}
        {supplier.phone && (
          <a
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-stone-800 ring-1 ring-stone-300 ring-inset hover:bg-stone-50"
            href={`sms:${supplier.phone.replace(/[^0-9+]/g, "")}?&body=${encodeURIComponent(message)}`}
          >
            <MessageSquare className="size-4" aria-hidden />
            Text
          </a>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Not yet
        </Button>
        <Button icon={Check} onClick={onSent}>
          Mark as sent · {formatMoney(orderTotal({ lines }))}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function IncomingOrderCard({ order, supplier }: { order: Order; supplier?: Supplier }) {
  const now = useNow();
  const [receiving, setReceiving] = useState(false);
  const eta = supplier ? nextDelivery(supplier, order.createdAt) : null;
  const late = eta ? now > eta.getTime() + 86_400_000 : false;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{supplier?.name ?? "Supplier"}</h2>
          <p className="text-sm text-stone-500">Sent {timeAgo(order.createdAt, now).toLowerCase()}</p>
        </div>
        {eta && (
          <span
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
              late ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-800",
            )}
          >
            <Truck className="size-4" aria-hidden />
            {late ? "Was due" : "Expected"} {formatDate(eta.getTime())}
          </span>
        )}
      </div>
      <ul className="mt-3 flex-1 space-y-1.5 px-5 text-[15px]">
        {order.lines.map((l) => (
          <li key={l.itemId} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              <span className="font-medium tabular-nums">{qtyWithUnit(l.qty, l.unit)}</span>{" "}
              <span className="text-stone-600">{l.name}</span>
            </span>
            <span className="text-stone-500 tabular-nums">{formatMoney(l.qty * l.cost)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 px-5 py-4">
        <p className="text-sm text-stone-600">
          Total <span className="font-semibold text-stone-900 tabular-nums">{formatMoney(orderTotal(order))}</span>
        </p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={() => {
              if (window.confirm(`Cancel this order from ${supplier?.name ?? "this supplier"}?`)) cancelOrder(order.id);
            }}
          >
            Cancel
          </Button>
          <Button size="sm" icon={PackageCheck} onClick={() => setReceiving(true)}>
            Check in delivery
          </Button>
        </div>
      </div>
      <Dialog
        open={receiving}
        onClose={() => setReceiving(false)}
        title="Check in delivery"
        description="Change any amount that didn't arrive as ordered. Everything here gets added to your stock."
      >
        <ReceiveBody
          order={order}
          onDone={(received) => {
            receiveOrder(order.id, received);
            setReceiving(false);
          }}
          onCancel={() => setReceiving(false)}
        />
      </Dialog>
    </Card>
  );
}

function ReceiveBody({
  order,
  onDone,
  onCancel,
}: {
  order: Order;
  onDone: (received: Record<string, number>) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.lines.map((l) => [l.itemId, String(l.qty)])),
  );
  return (
    <div>
      <ul className="divide-y divide-stone-100">
        {order.lines.map((l) => {
          const n = parseQty(qty[l.itemId] ?? "") ?? 0;
          const short = n < l.qty;
          return (
            <li key={l.itemId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{l.name}</p>
                <p className={cx("text-[13px]", short ? "text-amber-800" : "text-stone-500")}>
                  Ordered {qtyWithUnit(l.qty, l.unit)}
                  {short && ` · ${formatQty(l.qty - n)} short`}
                </p>
              </div>
              <Stepper
                label={`${l.name} received`}
                value={qty[l.itemId] ?? ""}
                onChange={(v) => setQty((q) => ({ ...q, [l.itemId]: v }))}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          icon={PackageCheck}
          onClick={() =>
            onDone(Object.fromEntries(order.lines.map((l) => [l.itemId, Math.max(0, parseQty(qty[l.itemId] ?? "") ?? 0)])))
          }
        >
          Add to stock
        </Button>
      </div>
    </div>
  );
}

function PastOrderRow({ order, supplier }: { order: Order; supplier?: Supplier }) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3.5 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <PackageCheck className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{supplier?.name ?? "Supplier"}</span>
            <span className="block text-[13px] text-stone-500">
              Received {order.receivedAt ? formatDateTime(order.receivedAt) : "—"} · {order.lines.length} item
              {order.lines.length === 1 ? "" : "s"}
            </span>
          </span>
          <span className="text-[15px] font-medium tabular-nums">{formatMoney(orderTotal(order))}</span>
          <Plus className="size-4 text-stone-400 transition-transform group-open:rotate-45" aria-hidden />
        </summary>
        <ul className="space-y-1 px-5 pb-4 pl-[4.25rem] text-sm text-stone-600">
          {order.lines.map((l) => (
            <li key={l.itemId} className="flex justify-between gap-3">
              <span>
                {qtyWithUnit(l.qty, l.unit)} {l.name}
              </span>
              <span className="tabular-nums">{formatMoney(l.qty * l.cost)}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
