"use client";

// A tiny client-side store saved to this browser's localStorage.
// Components read it with `useInventory()` and change it with the actions below.

import { useSyncExternalStore } from "react";
import {
  type Area,
  type InventoryState,
  type Item,
  type Order,
  type OrderLine,
  type Supplier,
  type ActivityKind,
  createEmptyState,
  createSampleState,
  formatMoney,
  newId,
  orderTotal,
  stockStatus,
} from "./data";

const STORAGE_KEY = "restaurant_inventory_v1";

let state: InventoryState | null = null;
const listeners = new Set<() => void>();

function load(): InventoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InventoryState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) return parsed;
    }
  } catch {
    // Storage blocked or corrupted: fall back to sample data.
  }
  return createSampleState(Date.now());
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore — the app still works for this visit.
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  if (!state) state = load();
  return state;
}

function getServerSnapshot() {
  return null;
}

/** Current inventory, or `null` while the page is loading on the server. */
export function useInventory(): InventoryState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ------------------------------------------------------------------ */
/* Toasts (with undo)                                                  */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: number;
  message: string;
  undo: InventoryState | null;
}

let toast: Toast | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const toastListeners = new Set<() => void>();

function emitToast() {
  for (const l of toastListeners) l();
}

export function showToast(message: string, undo: InventoryState | null = null) {
  toast = { id: Date.now(), message, undo };
  emitToast();
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(dismissToast, undo ? 7000 : 4000);
}

export function dismissToast() {
  toast = null;
  emitToast();
}

export function undoToast() {
  if (toast?.undo) {
    state = toast.undo;
    persist();
    emit();
  }
  dismissToast();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toast,
    () => null,
  );
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

let now = typeof window === "undefined" ? 0 : Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

/** The current time, refreshed every 30 seconds. */
export function useNow() {
  return useSyncExternalStore(
    (l) => {
      clockListeners.add(l);
      if (!clockTimer) {
        clockTimer = setInterval(() => {
          now = Date.now();
          for (const fn of clockListeners) fn();
        }, 30_000);
      }
      return () => {
        clockListeners.delete(l);
        if (clockListeners.size === 0 && clockTimer) {
          clearInterval(clockTimer);
          clockTimer = null;
        }
      };
    },
    () => now,
    () => 0,
  );
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function commit(
  recipe: (s: InventoryState) => InventoryState,
  opts: { toast?: string; undoable?: boolean } = {},
) {
  const prev = getSnapshot();
  state = recipe(prev);
  now = Date.now();
  persist();
  emit();
  if (opts.toast) showToast(opts.toast, opts.undoable ? prev : null);
}

function withActivity(s: InventoryState, kind: ActivityKind, text: string): InventoryState {
  const entry = { id: newId("act"), at: Date.now(), kind, text };
  return { ...s, activity: [entry, ...s.activity].slice(0, 60) };
}

export function setRestaurantName(name: string) {
  commit((s) => ({ ...s, restaurantName: name.trim() || s.restaurantName }), { toast: "Restaurant name saved" });
}

export function saveItem(item: Item) {
  commit(
    (s) => {
      const exists = s.items.some((i) => i.id === item.id);
      const items = exists ? s.items.map((i) => (i.id === item.id ? item : i)) : [...s.items, item];
      return withActivity({ ...s, items }, "item", exists ? `Updated ${item.name}` : `Added ${item.name}`);
    },
    { toast: `${item.name} saved`, undoable: true },
  );
}

export function deleteItem(id: string) {
  const name = getSnapshot().items.find((i) => i.id === id)?.name ?? "Item";
  commit(
    (s) => withActivity({ ...s, items: s.items.filter((i) => i.id !== id) }, "item", `Removed ${name}`),
    { toast: `${name} removed`, undoable: true },
  );
}

/**
 * Save what was counted on the shelves. `counts` maps item id → units on hand.
 * `completedAreas` are storage areas where every item was counted.
 */
export function saveCount(counts: Record<string, number>, completedAreas: Area[]) {
  const ids = Object.keys(counts);
  if (ids.length === 0) return;
  const at = Date.now();
  const s0 = getSnapshot();
  const counted = s0.items.filter((i) => i.id in counts);
  const newlyLow = counted.filter(
    (i) => stockStatus(i) === "ok" && stockStatus({ ...i, onHand: counts[i.id] }) !== "ok",
  ).length;
  const touched = [...new Set(counted.map((i) => i.area))];
  commit(
    (s) => {
      const items = s.items.map((i) =>
        i.id in counts ? { ...i, onHand: Math.max(0, counts[i.id]), countedAt: at } : i,
      );
      const lastCounted = { ...s.lastCounted };
      for (const a of completedAreas) lastCounted[a] = at;
      const where = touched.length === 2 ? touched.join(" and ") : touched.join(", ");
      return withActivity(
        { ...s, items, lastCounted },
        "count",
        `Counted ${where} · ${ids.length} item${ids.length === 1 ? "" : "s"}`,
      );
    },
    {
      toast:
        newlyLow > 0
          ? `Count saved. ${newlyLow} item${newlyLow === 1 ? " is" : "s are"} now running low.`
          : "Count saved.",
      undoable: true,
    },
  );
}

/* Count in progress — kept in memory so you can switch pages without losing it. */
const EMPTY_DRAFT: Record<string, string> = {};
let countDraft: Record<string, string> = EMPTY_DRAFT;
const draftListeners = new Set<() => void>();

export function useCountDraft() {
  return useSyncExternalStore(
    (l) => {
      draftListeners.add(l);
      return () => draftListeners.delete(l);
    },
    () => countDraft,
    () => EMPTY_DRAFT,
  );
}

export function setCountDraft(next: Record<string, string>) {
  countDraft = next;
  for (const l of draftListeners) l();
}

export function sendOrder(supplierId: string, lines: OrderLine[]) {
  const s0 = getSnapshot();
  const supplier = s0.suppliers.find((x) => x.id === supplierId);
  const order: Order = {
    id: newId("ord"),
    supplierId,
    createdAt: Date.now(),
    status: "sent",
    receivedAt: null,
    lines: lines.filter((l) => l.qty > 0),
  };
  commit(
    (s) =>
      withActivity(
        { ...s, orders: [order, ...s.orders] },
        "order",
        `Order sent to ${supplier?.name ?? "supplier"} · ${formatMoney(orderTotal(order))}`,
      ),
    { toast: `Order to ${supplier?.name ?? "supplier"} marked as sent`, undoable: true },
  );
}

/** Add a delivery to stock. `received` maps item id → units that actually arrived. */
export function receiveOrder(orderId: string, received: Record<string, number>) {
  const s0 = getSnapshot();
  const order = s0.orders.find((o) => o.id === orderId);
  if (!order) return;
  const supplier = s0.suppliers.find((x) => x.id === order.supplierId);
  commit(
    (s) => {
      const items = s.items.map((i) => (i.id in received ? { ...i, onHand: i.onHand + Math.max(0, received[i.id]) } : i));
      const orders = s.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "received" as const,
              receivedAt: Date.now(),
              lines: o.lines.map((l) => ({ ...l, qty: received[l.itemId] ?? l.qty })),
            }
          : o,
      );
      return withActivity({ ...s, items, orders }, "received", `Delivery from ${supplier?.name ?? "supplier"} added to stock`);
    },
    { toast: "Delivery added to your stock", undoable: true },
  );
}

export function cancelOrder(orderId: string) {
  commit((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== orderId) }), {
    toast: "Order cancelled",
    undoable: true,
  });
}

export function saveSupplier(supplier: Supplier) {
  commit(
    (s) => {
      const exists = s.suppliers.some((x) => x.id === supplier.id);
      const suppliers = exists
        ? s.suppliers.map((x) => (x.id === supplier.id ? supplier : x))
        : [...s.suppliers, supplier];
      return { ...s, suppliers };
    },
    { toast: `${supplier.name} saved`, undoable: true },
  );
}

export function deleteSupplier(id: string) {
  const s0 = getSnapshot();
  const name = s0.suppliers.find((x) => x.id === id)?.name ?? "Supplier";
  commit((s) => ({ ...s, suppliers: s.suppliers.filter((x) => x.id !== id) }), {
    toast: `${name} removed`,
    undoable: true,
  });
}

export function loadSampleData() {
  const name = getSnapshot().restaurantName;
  commit(() => ({ ...createSampleState(Date.now()), restaurantName: name }), {
    toast: "Sample data loaded",
    undoable: true,
  });
}

export function clearAllData() {
  const name = getSnapshot().restaurantName;
  commit(() => createEmptyState(name), { toast: "All items, suppliers and orders cleared", undoable: true });
}
