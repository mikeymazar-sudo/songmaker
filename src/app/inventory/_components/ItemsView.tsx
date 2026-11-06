"use client";

import { useMemo, useState } from "react";
import { ChevronRight, PackageOpen, Plus, Search, X } from "lucide-react";
import {
  AREAS,
  CATEGORIES,
  type Area,
  type Category,
  type Item,
  type StockStatus,
  formatMoney,
  formatQty,
  onOrderQty,
  pluralUnit,
  stockStatus,
  stockValue,
} from "../_lib/data";
import { useInventory } from "../_lib/store";
import { ItemSheet } from "./ItemSheet";
import { Button, Card, EmptyState, PageHeader, Segmented, Select, StatusBadge, StockMeter, cx, focusRing } from "./ui";

type StatusFilter = "all" | "attention" | "low" | "out";

function matchesStatus(filter: StatusFilter, s: StockStatus) {
  if (filter === "all") return true;
  if (filter === "attention") return s !== "ok";
  return s === filter;
}

type SheetState = { mode: "edit"; id: string } | { mode: "new" } | null;

export function ItemsView({
  initialStatus,
  initialItemId,
  startNew,
}: {
  initialStatus: StatusFilter;
  initialItemId: string | null;
  startNew: boolean;
}) {
  const inv = useInventory();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [category, setCategory] = useState<Category | "all">("all");
  const [area, setArea] = useState<Area | "all">("all");
  const [sheet, setSheet] = useState<SheetState>(
    startNew ? { mode: "new" } : initialItemId ? { mode: "edit", id: initialItemId } : null,
  );

  const supplierName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of inv?.suppliers ?? []) m.set(s.id, s.name);
    return m;
  }, [inv?.suppliers]);

  const rows = useMemo(() => {
    if (!inv) return [];
    const q = query.trim().toLowerCase();
    return inv.items
      .map((item) => ({ item, status: stockStatus(item) }))
      .filter(({ item, status: s }) => {
        if (!matchesStatus(status, s)) return false;
        if (category !== "all" && item.category !== category) return false;
        if (area !== "all" && item.area !== area) return false;
        if (q) {
          const hay = `${item.name} ${item.category} ${supplierName.get(item.supplierId) ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [inv, query, status, category, area, supplierName]);

  const counts = useMemo(() => {
    const c = { all: 0, attention: 0, low: 0, out: 0 };
    for (const i of inv?.items ?? []) {
      const s = stockStatus(i);
      c.all++;
      if (s !== "ok") c.attention++;
      if (s === "low") c.low++;
      if (s === "out") c.out++;
    }
    return c;
  }, [inv?.items]);

  if (!inv) return null;

  const groups = CATEGORIES.map((c) => ({
    category: c,
    rows: rows
      .filter((r) => r.item.category === c)
      .sort((a, b) => a.item.name.localeCompare(b.item.name)),
  })).filter((g) => g.rows.length > 0);

  const editing = sheet?.mode === "edit" ? (inv.items.find((i) => i.id === sheet.id) ?? null) : null;
  const filtersOn = query || status !== "all" || category !== "all" || area !== "all";
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setCategory("all");
    setArea("all");
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`${inv.items.length} items worth ${formatMoney(stockValue(inv.items), { round: true })} on your shelves. Tap any item to update it.`}
        actions={
          <Button icon={Plus} onClick={() => setSheet({ mode: "new" })}>
            Add item
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <Segmented
            label="Filter by stock level"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "attention", label: "Needs attention", count: counts.attention },
              { value: "low", label: "Running low", count: counts.low },
              { value: "out", label: "Out of stock", count: counts.out },
            ]}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_200px_200px]">
          <label className="relative block">
            <span className="sr-only">Search items</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-stone-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by item or supplier"
              className="h-11 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-[15px] placeholder:text-stone-400 hover:border-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 focus:outline-none"
            />
          </label>
          <Select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "all")}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select aria-label="Storage area" value={area} onChange={(e) => setArea(e.target.value as Area | "all")}>
            <option value="all">All storage areas</option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </div>
      </div>

      {inv.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageOpen}
            title="No items yet"
            action={
              <Button icon={Plus} onClick={() => setSheet({ mode: "new" })}>
                Add your first item
              </Button>
            }
          >
            Add the ingredients and supplies you buy. You only need a name, how you buy it, and how many you like to keep on
            hand.
          </EmptyState>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Nothing matches"
            action={
              <Button variant="secondary" icon={X} onClick={clearFilters}>
                Clear filters
              </Button>
            }
          >
            Try a different search or filter.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Column labels (desktop) */}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_7.5rem_1rem] gap-4 border-b border-stone-200 bg-stone-50/80 px-5 py-2.5 text-[13px] font-medium text-stone-500 md:grid">
            <span>Item</span>
            <span>Stored in</span>
            <span>On hand / par</span>
            <span className="text-right">Value</span>
            <span>Status</span>
            <span />
          </div>
          {groups.map((g) => (
            <div key={g.category}>
              <h2 className="flex items-baseline gap-2 border-b border-stone-100 bg-stone-50/50 px-5 pt-4 pb-2 text-sm font-semibold text-stone-900">
                {g.category}
                <span className="text-[13px] font-normal text-stone-500">{g.rows.length}</span>
              </h2>
              <ul className="divide-y divide-stone-100">
                {g.rows.map(({ item, status: s }) => (
                  <li key={item.id}>
                    <ItemRow
                      item={item}
                      status={s}
                      coming={onOrderQty(item.id, inv.orders)}
                      supplier={supplierName.get(item.supplierId)}
                      onOpen={() => setSheet({ mode: "edit", id: item.id })}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      {filtersOn && groups.length > 0 && (
        <p className="mt-3 text-center text-sm text-stone-500">
          Showing {rows.length} of {inv.items.length} items ·{" "}
          <button type="button" onClick={clearFilters} className={cx("font-medium text-stone-800 underline", focusRing)}>
            Show all
          </button>
        </p>
      )}

      <ItemSheet
        open={sheet !== null && (sheet.mode === "new" || editing !== null)}
        onClose={() => setSheet(null)}
        item={editing}
        defaults={{
          category: category !== "all" ? category : undefined,
          area: area !== "all" ? area : undefined,
        }}
      />
    </div>
  );
}

function ItemRow({
  item,
  status,
  coming,
  supplier,
  onOpen,
}: {
  item: Item;
  status: StockStatus;
  coming: number;
  supplier?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "w-full px-5 py-3.5 text-left transition-colors hover:bg-stone-50 focus-visible:-outline-offset-2",
        focusRing,
        "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_7.5rem_1rem] md:items-center md:gap-4",
      )}
    >
      {/* Name */}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-stone-900">{item.name}</p>
          <p className="truncate text-[13px] text-stone-500">
            {item.packSize ? `${item.unit} · ${item.packSize}` : `by the ${item.unit}`}
            {supplier && <span className="hidden lg:inline"> · {supplier}</span>}
          </p>
        </div>
        <span className="shrink-0 md:hidden">
          <StatusBadge status={status} short />
        </span>
      </div>

      {/* Area */}
      <p className="hidden truncate text-sm text-stone-600 md:block">{item.area}</p>

      {/* Level */}
      <div className="mt-2.5 md:mt-0">
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm md:justify-start">
          <span className="text-stone-900 tabular-nums">
            <span className="font-semibold">{formatQty(item.onHand)}</span>
            <span className="text-stone-500">
              {" "}
              / {formatQty(item.par)} {pluralUnit(item.unit, item.par)}
            </span>
          </span>
          <span className="text-[13px] text-stone-500 md:hidden">{item.area}</span>
        </div>
        <StockMeter onHand={item.onHand} par={item.par} status={status} className="md:max-w-40" />
        {coming > 0 && <p className="mt-1 text-[12px] text-blue-700">{formatQty(coming)} on the way</p>}
      </div>

      {/* Value */}
      <p className="hidden text-right text-sm text-stone-700 tabular-nums md:block">
        {formatMoney(item.onHand * item.cost)}
      </p>

      {/* Status */}
      <div className="hidden md:block">
        <StatusBadge status={status} short />
      </div>

      <ChevronRight className="hidden size-4 text-stone-400 md:block" aria-hidden />
    </button>
  );
}
