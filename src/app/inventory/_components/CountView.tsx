"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, ClipboardCheck, Info, RotateCcw } from "lucide-react";
import { AREAS, CATEGORIES, type Area, formatQty, pluralUnit, qtyWithUnit, timeAgo } from "../_lib/data";
import { saveCount, setCountDraft, useCountDraft, useInventory, useNow } from "../_lib/store";
import { AREA_ICON } from "./icons";
import { Button, ButtonLink, Card, EmptyState, PageHeader, Stepper, cx, focusRing, parseQty } from "./ui";

export function CountView({ initialArea }: { initialArea: string | null }) {
  const inv = useInventory();
  const now = useNow();
  const draft = useCountDraft();

  const areas = useMemo(
    () => AREAS.filter((a) => inv?.items.some((i) => i.area === a)),
    [inv?.items],
  );
  const [area, setArea] = useState<Area>(
    (AREAS as readonly string[]).includes(initialArea ?? "") ? (initialArea as Area) : "Walk-in Cooler",
  );
  const activeArea = areas.includes(area) ? area : (areas[0] ?? area);

  const countedIds = useMemo(
    () => new Set(Object.keys(draft).filter((id) => parseQty(draft[id]) !== null)),
    [draft],
  );

  // Warn before closing the tab with an unsaved count.
  const hasDraft = countedIds.size > 0;
  useEffect(() => {
    if (!hasDraft) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDraft]);

  if (!inv) return null;

  if (inv.items.length === 0) {
    return (
      <div>
        <PageHeader title="Count stock" />
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to count yet"
            action={<ButtonLink href="/inventory/items?new=1">Add an item</ButtonLink>}
          >
            Add the items you keep in stock first, then come back here to count them.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const catIndex = (c: string) => CATEGORIES.indexOf(c as (typeof CATEGORIES)[number]);
  const areaItems = inv.items
    .filter((i) => i.area === activeArea)
    .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name));
  const areaLeft = areaItems.filter((i) => !countedIds.has(i.id));

  const setValue = (id: string, v: string) => {
    const next = { ...draft };
    if (v === "") delete next[id];
    else next[id] = v;
    setCountDraft(next);
  };

  const fillRest = () => {
    const next = { ...draft };
    for (const i of areaLeft) next[i.id] = String(i.onHand);
    setCountDraft(next);
  };

  const save = () => {
    const counts: Record<string, number> = {};
    for (const id of countedIds) {
      const n = parseQty(draft[id]);
      if (n !== null) counts[id] = n;
    }
    const complete = areas.filter((a) =>
      inv.items.filter((i) => i.area === a).every((i) => i.id in counts),
    );
    saveCount(counts, complete);
    setCountDraft({});
  };

  const total = inv.items.length;
  const done = countedIds.size;

  return (
    <div className="pb-20">
      <PageHeader
        title="Count stock"
        description="Go one storage area at a time and enter what's on the shelf. Nothing changes until you save."
      />

      {/* Area picker */}
      <div role="tablist" aria-label="Storage areas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {areas.map((a) => {
          const Icon = AREA_ICON[a];
          const items = inv.items.filter((i) => i.area === a);
          const counted = items.filter((i) => countedIds.has(i.id)).length;
          const selected = a === activeArea;
          const complete = counted === items.length;
          return (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setArea(a)}
              className={cx(
                "rounded-2xl p-4 text-left transition-all",
                focusRing,
                selected
                  ? "bg-stone-900 text-white shadow-lg"
                  : "bg-white text-stone-900 ring-1 ring-stone-900/[0.07] hover:shadow-md",
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className={cx("size-5", selected ? "text-white" : "text-stone-500")} aria-hidden />
                {complete && (
                  <span
                    className={cx(
                      "flex size-6 items-center justify-center rounded-full",
                      selected ? "bg-emerald-400 text-stone-900" : "bg-emerald-100 text-emerald-700",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} aria-label="All counted" />
                  </span>
                )}
              </div>
              <p className="mt-3 font-semibold">{a}</p>
              <p className={cx("text-[13px]", selected ? "text-stone-300" : "text-stone-500")}>
                {counted} of {items.length} counted
              </p>
              <div className={cx("mt-2.5 h-1 overflow-hidden rounded-full", selected ? "bg-white/20" : "bg-stone-100")}>
                <div
                  className={cx("h-full rounded-full", selected ? "bg-emerald-400" : "bg-emerald-500")}
                  style={{ width: `${items.length ? (counted / items.length) * 100 : 0}%` }}
                />
              </div>
              <p className={cx("mt-2 text-[12px]", selected ? "text-stone-400" : "text-stone-400")}>
                Last full count: {timeAgo(inv.lastCounted[a], now).toLowerCase()}
              </p>
            </button>
          );
        })}
      </div>

      {/* Items in the selected area */}
      <Card className="mt-6 overflow-hidden" role="tabpanel" aria-label={activeArea}>
        <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold">{activeArea}</h2>
            <p className="flex items-center gap-1.5 text-sm text-stone-500">
              <Info className="size-3.5 shrink-0" aria-hidden />
              Count in the unit you buy in. Half a case? Enter 0.5.
            </p>
          </div>
          {areaLeft.length > 0 && (
            <Button variant="secondary" size="sm" icon={CheckCheck} onClick={fillRest}>
              Rest haven&rsquo;t changed
            </Button>
          )}
        </div>
        <ul className="divide-y divide-stone-100">
          {areaItems.map((item) => {
            const raw = draft[item.id] ?? "";
            const n = parseQty(raw);
            const counted = n !== null;
            const diff = counted ? n - item.onHand : 0;
            return (
              <li
                key={item.id}
                className={cx(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors sm:flex-nowrap",
                  counted && "bg-emerald-50/40",
                )}
              >
                <span
                  className={cx(
                    "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                    counted ? "bg-emerald-500 text-white" : "ring-1 ring-stone-300 ring-inset",
                  )}
                  aria-hidden
                >
                  {counted && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-stone-900">{item.name}</p>
                  <p className="truncate text-[13px] text-stone-500">
                    {counted && diff !== 0 ? (
                      <>
                        Was {qtyWithUnit(item.onHand, item.unit)}{" "}
                        <span className={diff < 0 ? "text-stone-700" : "text-stone-700"}>
                          ({diff > 0 ? "+" : "−"}
                          {formatQty(Math.abs(diff))})
                        </span>
                      </>
                    ) : (
                      <>
                        Last count: {qtyWithUnit(item.onHand, item.unit)}
                        {item.packSize && ` · ${item.packSize} each`}
                      </>
                    )}
                  </p>
                </div>
                <div className="ml-10 flex items-center gap-2 sm:ml-0">
                  <Stepper
                    size="lg"
                    label={`${item.name} count`}
                    value={raw}
                    onChange={(v) => setValue(item.id, v)}
                    step={1}
                    placeholder="–"
                  />
                  <span className="w-14 text-sm text-stone-500">{pluralUnit(item.unit, n ?? 2)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-stone-900/[0.08] bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-stone-900 tabular-nums">
              {done} of {total} counted
            </p>
            <div className="mt-1.5 h-1.5 max-w-xs overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
          {hasDraft && (
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={() => {
                if (window.confirm("Clear the numbers you've entered?")) setCountDraft({});
              }}
            >
              <span className="sr-only sm:not-sr-only">Start over</span>
            </Button>
          )}
          <Button size="lg" icon={ClipboardCheck} disabled={!hasDraft} onClick={save}>
            Save count
          </Button>
        </div>
      </div>
    </div>
  );
}
