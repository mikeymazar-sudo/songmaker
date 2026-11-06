"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AREAS,
  CATEGORIES,
  type Area,
  type Category,
  type Item,
  formatMoney,
  newId,
  onOrderQty,
  pluralUnit,
  qtyWithUnit,
  stockStatus,
  timeAgo,
} from "../_lib/data";
import { deleteItem, saveItem, useInventory, useNow } from "../_lib/store";
import { Button, Field, Select, Sheet, StatusBadge, StockMeter, Stepper, TextInput, inputClass, parseQty } from "./ui";

export function ItemSheet({
  open,
  onClose,
  item,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  /** Existing item to edit, or null to add a new one. */
  item: Item | null;
  defaults?: Partial<Pick<Item, "category" | "area" | "supplierId">>;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? item.name : "Add an item"}
      description={item ? `${item.category} · ${item.area}` : "Anything you buy and want to keep track of."}
    >
      <ItemForm key={item?.id ?? "new"} item={item} defaults={defaults} onDone={onClose} />
    </Sheet>
  );
}

function ItemForm({
  item,
  defaults,
  onDone,
}: {
  item: Item | null;
  defaults?: Partial<Pick<Item, "category" | "area" | "supplierId">>;
  onDone: () => void;
}) {
  const inv = useInventory();
  const now = useNow();
  const suppliers = inv?.suppliers ?? [];

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<Category>(item?.category ?? defaults?.category ?? "Produce");
  const [area, setArea] = useState<Area>(item?.area ?? defaults?.area ?? "Walk-in Cooler");
  const [supplierId, setSupplierId] = useState(item?.supplierId ?? defaults?.supplierId ?? suppliers[0]?.id ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "case");
  const [packSize, setPackSize] = useState(item?.packSize ?? "");
  const [cost, setCost] = useState(item ? String(item.cost) : "");
  const [par, setPar] = useState(item ? String(item.par) : "");
  const [onHand, setOnHand] = useState(item ? String(item.onHand) : "");
  const [error, setError] = useState<string | null>(null);

  const parN = parseQty(par) ?? 0;
  const onHandN = parseQty(onHand) ?? 0;
  const costN = parseQty(cost) ?? 0;
  const preview = stockStatus({ onHand: onHandN, par: parN });
  const coming = item && inv ? onOrderQty(item.id, inv.orders) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the item a name.");
    if (!unit.trim()) return setError("Add a unit, like case, bag or lb.");
    if (parseQty(par) === null) return setError("Set a par level — how many you want on hand.");
    saveItem({
      id: item?.id ?? newId("item"),
      name: name.trim(),
      category,
      area,
      supplierId,
      unit: unit.trim(),
      packSize: packSize.trim(),
      cost: Math.max(0, costN),
      par: Math.max(0, parN),
      onHand: Math.max(0, onHandN),
      countedAt: item && item.onHand === onHandN ? item.countedAt : Date.now(),
    });
    onDone();
  };

  const unitLabel = unit.trim() ? pluralUnit(unit.trim(), 2) : "units";

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6">
        {item && (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/[0.07]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {qtyWithUnit(onHandN, unit)}
                <span className="ml-1.5 text-sm font-normal tracking-normal text-stone-500">on hand</span>
              </p>
              <StatusBadge status={preview} />
            </div>
            <StockMeter onHand={onHandN} par={parN} status={preview} className="mt-3" />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-stone-500">
              <div>
                <dt className="inline">Value: </dt>
                <dd className="inline font-medium text-stone-800">{formatMoney(onHandN * costN)}</dd>
              </div>
              <div>
                <dt className="inline">Last counted: </dt>
                <dd className="inline font-medium text-stone-800">{timeAgo(item.countedAt, now)}</dd>
              </div>
              {coming > 0 && (
                <div className="col-span-2">
                  <dt className="inline">On the way: </dt>
                  <dd className="inline font-medium text-stone-800">{qtyWithUnit(coming, item.unit)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <Field label="Item name" htmlFor="item-name">
          <TextInput
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Romaine lettuce"
            autoFocus={!item}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="item-category">
            <Select id="item-category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Stored in" htmlFor="item-area">
            <Select id="item-area" value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Supplier" htmlFor="item-supplier" hint="Who you order this from.">
          <Select id="item-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">No supplier yet</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="You buy it by the…" htmlFor="item-unit" hint="case, bag, lb, bottle">
            <TextInput id="item-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="case" />
          </Field>
          <Field label="What's in one" htmlFor="item-pack" hint="Optional, e.g. 24 heads">
            <TextInput
              id="item-pack"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
              placeholder="24 heads"
            />
          </Field>
        </div>

        <Field label={`Price per ${unit.trim() || "unit"}`} htmlFor="item-cost">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-500">$</span>
            <input
              id="item-cost"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="0.00"
              className={`${inputClass} pl-7 tabular-nums`}
            />
          </div>
        </Field>

        <div className="space-y-5 rounded-2xl bg-stone-100/70 p-4">
          <Field
            label="Par level"
            htmlFor="item-par"
            hint={`How many ${unitLabel} you want on the shelf right after a delivery. We suggest orders that bring you back to this number.`}
          >
            <Stepper id="item-par" label="par level" value={par} onChange={setPar} placeholder="0" />
          </Field>
          <Field label="On hand right now" htmlFor="item-onhand" hint="Half units are fine — type 1.5 for one and a half.">
            <Stepper id="item-onhand" label="on hand" value={onHand} onChange={setOnHand} step={0.5} placeholder="0" />
          </Field>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-8 -mb-5 flex items-center gap-2 border-t border-stone-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {item && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              if (window.confirm(`Remove ${item.name} from your inventory?`)) {
                deleteItem(item.id);
                onDone();
              }
            }}
          >
            <span className="sr-only sm:not-sr-only">Remove</span>
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{item ? "Save changes" : "Add item"}</Button>
      </div>
    </form>
  );
}
