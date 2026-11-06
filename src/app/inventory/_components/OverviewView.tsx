"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  ChevronRight,
  CircleX,
  ClipboardCheck,
  Package,
  Plus,
  Store,
  Truck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  AREAS,
  CATEGORIES,
  daysSince,
  formatDate,
  formatMoney,
  nextDelivery,
  onOrderQty,
  orderTotal,
  pluralUnit,
  formatQty,
  stockStatus,
  stockValue,
  suggestedQty,
  timeAgo,
} from "../_lib/data";
import { loadSampleData, useInventory, useNow } from "../_lib/store";
import { ACTIVITY_ICON, AREA_ICON } from "./icons";
import { Button, ButtonLink, Card, CardHeader, StatusBadge, StockMeter, cx, focusRing } from "./ui";

const COUNT_DUE_DAYS = 7;

function greeting(now: number) {
  const h = new Date(now).getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function OverviewView() {
  const inv = useInventory();
  const now = useNow();

  const data = useMemo(() => {
    if (!inv) return null;
    const withStatus = inv.items.map((i) => ({ item: i, status: stockStatus(i) }));
    const out = withStatus.filter((x) => x.status === "out");
    const low = withStatus.filter((x) => x.status === "low");
    const attention = [...out, ...low].sort((a, b) => {
      if (a.status !== b.status) return a.status === "out" ? -1 : 1;
      return a.item.onHand / (a.item.par || 1) - b.item.onHand / (b.item.par || 1);
    });

    const toOrder = inv.items
      .map((i) => ({ item: i, qty: suggestedQty(i, inv.orders) }))
      .filter((x) => x.qty > 0);
    const orderValue = toOrder.reduce((s, x) => s + x.qty * x.item.cost, 0);
    const orderSuppliers = new Set(toOrder.map((x) => x.item.supplierId)).size;

    const byCategory = CATEGORIES.map((c) => {
      const items = inv.items.filter((i) => i.category === c);
      return { category: c, value: stockValue(items), count: items.length };
    })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.value - a.value);

    return {
      total: stockValue(inv.items),
      out,
      low,
      attention,
      toOrder,
      orderValue,
      orderSuppliers,
      byCategory,
      incoming: inv.orders.filter((o) => o.status === "sent"),
    };
  }, [inv]);

  if (!inv || !data) return null;

  if (inv.items.length === 0) return <GettingStarted />;

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{now ? formatDate(now) : " "}</p>
          <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">
            {now ? greeting(now) : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-[15px] text-stone-600">
            {data.attention.length === 0
              ? "Everything is stocked up. Nice work."
              : `${data.attention.length} item${data.attention.length === 1 ? " needs" : "s need"} your attention today.`}
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/inventory/count" variant="secondary" icon={ClipboardCheck}>
            Count stock
          </ButtonLink>
          <ButtonLink href="/inventory/orders" icon={Truck}>
            Review order
          </ButtonLink>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Package}
          label="Stock on hand"
          value={formatMoney(data.total, { round: true })}
          note="What's on your shelves"
          href="/inventory/items"
        />
        <StatTile
          icon={TriangleAlert}
          tone="low"
          label="Running low"
          value={String(data.low.length)}
          unit={data.low.length === 1 ? "item" : "items"}
          note="Below your par level"
          href="/inventory/items?status=low"
        />
        <StatTile
          icon={CircleX}
          tone="out"
          label="Out of stock"
          value={String(data.out.length)}
          unit={data.out.length === 1 ? "item" : "items"}
          note="Nothing left on the shelf"
          href="/inventory/items?status=out"
        />
        <StatTile
          icon={Truck}
          label="Ready to order"
          value={formatMoney(data.orderValue, { round: true })}
          note={
            data.toOrder.length
              ? `${data.toOrder.length} items · ${data.orderSuppliers} supplier${data.orderSuppliers === 1 ? "" : "s"}`
              : "Nothing to order"
          }
          href="/inventory/orders"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Needs attention */}
          <Card>
            <CardHeader
              title="Needs attention"
              description="Out of stock first, then whatever is running lowest."
              action={
                data.attention.length > 0 ? (
                  <Link
                    href="/inventory/items?status=attention"
                    className={cx("shrink-0 text-sm font-medium text-stone-600 hover:text-stone-900", focusRing)}
                  >
                    See all {data.attention.length}
                  </Link>
                ) : undefined
              }
            />
            {data.attention.length === 0 ? (
              <p className="px-5 pb-6 text-[15px] text-stone-500">All items are at or above par.</p>
            ) : (
              <ul className="divide-y divide-stone-100 border-t border-stone-100">
                {data.attention.slice(0, 7).map(({ item, status }) => {
                  const coming = onOrderQty(item.id, inv.orders);
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/inventory/items?item=${item.id}`}
                        className={cx(
                          "flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-stone-50",
                          focusRing,
                          "focus-visible:-outline-offset-2",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-stone-900">{item.name}</p>
                          <p className="truncate text-[13px] text-stone-500">
                            {formatQty(item.onHand)} of {formatQty(item.par)} {pluralUnit(item.unit, item.par)} on hand
                            {coming > 0 && (
                              <span className="text-stone-700"> · {formatQty(coming)} on the way</span>
                            )}
                          </p>
                        </div>
                        <div className="hidden w-24 shrink-0 sm:block">
                          <StockMeter onHand={item.onHand} par={item.par} status={status} />
                        </div>
                        <div className="w-[112px] shrink-0 text-right">
                          <StatusBadge status={status} />
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-stone-400" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Money by category */}
          <Card>
            <CardHeader title="Where your money sits" description="Value of stock on hand, by category." />
            <ValueBars rows={data.byCategory} total={data.total} />
          </Card>
        </div>

        <div className="space-y-6">
          {/* Count reminders */}
          <Card>
            <CardHeader title="Stock counts" description={`We suggest counting each area at least weekly.`} />
            <ul className="space-y-1 px-3 pb-3">
              {AREAS.map((area) => {
                const Icon = AREA_ICON[area];
                const at = inv.lastCounted[area];
                const due = daysSince(at, now) >= COUNT_DUE_DAYS;
                const count = inv.items.filter((i) => i.area === area).length;
                if (count === 0) return null;
                return (
                  <li key={area}>
                    <Link
                      href={`/inventory/count?area=${encodeURIComponent(area)}`}
                      className={cx("flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-stone-50", focusRing)}
                    >
                      <span
                        className={cx(
                          "flex size-9 items-center justify-center rounded-lg",
                          due ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600",
                        )}
                      >
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-stone-900">{area}</span>
                        <span className="block text-[13px] text-stone-500">
                          {at ? `Counted ${timeAgo(at, now).toLowerCase()}` : "Not counted yet"}
                        </span>
                      </span>
                      {due ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] font-medium text-amber-900">
                          Count due
                        </span>
                      ) : (
                        <ChevronRight className="size-4 text-stone-400" aria-hidden />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Deliveries */}
          <Card>
            <CardHeader title="Deliveries on the way" />
            {data.incoming.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-stone-500">No orders waiting. Sent orders show up here.</p>
            ) : (
              <ul className="space-y-1 px-3 pb-3">
                {data.incoming.map((o) => {
                  const sup = inv.suppliers.find((s) => s.id === o.supplierId);
                  const eta = sup ? nextDelivery(sup, o.createdAt) : null;
                  return (
                    <li key={o.id}>
                      <Link
                        href="/inventory/orders?tab=incoming"
                        className={cx("flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-stone-50", focusRing)}
                      >
                        <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <Truck className="size-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-stone-900">
                            {sup?.name ?? "Supplier"}
                          </span>
                          <span className="block text-[13px] text-stone-500">
                            {eta ? `Expected ${formatDate(eta.getTime())}` : `Sent ${timeAgo(o.createdAt, now).toLowerCase()}`} ·{" "}
                            {formatMoney(orderTotal(o))}
                          </span>
                        </span>
                        <span className="text-sm font-medium text-stone-700">Check in</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title="Recent activity" />
            {inv.activity.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-stone-500">Counts, orders and deliveries will show up here.</p>
            ) : (
              <ol className="space-y-4 px-5 pt-1 pb-5">
                {inv.activity.slice(0, 6).map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind];
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600">
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm leading-snug text-stone-800">{a.text}</p>
                        <p className="mt-0.5 text-[13px] text-stone-500">{timeAgo(a.at, now)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  note,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  note: string;
  href: string;
  tone?: "low" | "out";
}) {
  const active = tone && value !== "0";
  return (
    <Link
      href={href}
      className={cx(
        "group flex flex-col rounded-2xl bg-white p-4 ring-1 ring-stone-900/[0.07] shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-shadow hover:shadow-md sm:p-5",
        focusRing,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-stone-600">
        <span
          className={cx(
            "flex size-7 items-center justify-center rounded-lg",
            active && tone === "low" && "bg-amber-100 text-amber-800",
            active && tone === "out" && "bg-red-100 text-red-700",
            !active && "bg-stone-100 text-stone-600",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </div>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums sm:text-[32px]">
        {value}
        {unit && <span className="ml-1.5 text-base font-medium tracking-normal text-stone-500">{unit}</span>}
      </p>
      <p className="mt-2 flex items-center gap-1 text-[13px] leading-snug text-stone-500">
        <span>{note}</span>
        <ArrowRight
          className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </p>
    </Link>
  );
}

/** Ranked horizontal bars: one hue, largest first, value printed beside each bar. */
function ValueBars({
  rows,
  total,
}: {
  rows: { category: string; value: number; count: number }[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="px-5 pt-1 pb-5">
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const share = total > 0 ? Math.round((r.value / total) * 100) : 0;
          return (
            <li
              key={r.category}
              tabIndex={0}
              className={cx(
                "group relative grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 rounded-lg sm:grid-cols-[9rem_1fr_5rem]",
                focusRing,
              )}
            >
              <span className="truncate text-sm text-stone-700">{r.category}</span>
              <span className="relative block h-6">
                <span
                  className="absolute inset-y-[7px] left-0 rounded-r-[4px] bg-[#2a78d6] transition-opacity group-hover:opacity-80"
                  style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }}
                />
              </span>
              <span className="text-right text-sm font-medium text-stone-900 tabular-nums">
                {formatMoney(r.value, { round: true })}
              </span>
              <span
                role="tooltip"
                className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-1 w-max max-w-full rounded-lg bg-stone-900 px-2.5 py-1.5 text-[13px] text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 sm:left-[9rem] sm:max-w-[calc(100%-9rem)]"
              >
                <span className="font-semibold">{r.category}</span> · {formatMoney(r.value)} · {share}% of stock ·{" "}
                {r.count} item{r.count === 1 ? "" : "s"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GettingStarted() {
  const steps = [
    {
      icon: Store,
      title: "Add your suppliers",
      text: "Who you buy from and which days they deliver.",
      href: "/inventory/suppliers",
    },
    {
      icon: Plus,
      title: "Add the items you buy",
      text: "Set a par level — how much you want on hand after a delivery.",
      href: "/inventory/items?new=1",
    },
    {
      icon: ClipboardCheck,
      title: "Count your stock",
      text: "Walk each storage area and enter what's on the shelf.",
      href: "/inventory/count",
    },
  ];
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Let&rsquo;s set up your inventory</h1>
      <p className="mt-2 text-[15px] text-stone-600">
        Three steps and you&rsquo;ll always know what&rsquo;s running low and what to order.
      </p>
      <ol className="mt-8 space-y-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className={cx(
                "flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-900/[0.07] transition-shadow hover:shadow-md",
                focusRing,
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
                <s.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-stone-500">Step {i + 1}</span>
                <span className="block font-semibold text-stone-900">{s.title}</span>
                <span className="block text-sm text-stone-500">{s.text}</span>
              </span>
              <ChevronRight className="size-5 text-stone-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-8 rounded-2xl border border-dashed border-stone-300 p-5 text-center">
        <p className="text-sm text-stone-600">Just looking around?</p>
        <Button variant="secondary" className="mt-3" onClick={loadSampleData}>
          Load a sample restaurant
        </Button>
      </div>
    </div>
  );
}
