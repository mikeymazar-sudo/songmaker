import type { AppState } from "./models";

export type SyncTable = "vendors" | "products" | "vendor_products" | "price_history" | "invoices" | "purchase_orders" | "audit_log";

export interface SyncRequest {
  upserts: Partial<Record<SyncTable, unknown[]>>;
  deletes: Partial<Record<SyncTable, string[]>>;
  settings?: { restaurantName?: string; orderOverrides?: AppState["orderOverrides"]; routing?: AppState["routing"] };
}

interface Collection<T> {
  table: SyncTable;
  pick: (s: AppState) => T[];
  key: (item: T) => string;
}

const COLLECTIONS: Collection<unknown>[] = [
  { table: "vendors", pick: (s) => s.vendors, key: (v) => (v as { id: string }).id },
  { table: "products", pick: (s) => s.products, key: (v) => (v as { id: string }).id },
  {
    table: "vendor_products",
    pick: (s) => s.vendorProducts,
    key: (v) => `${(v as { productId: string }).productId}|${(v as { vendorId: string }).vendorId}`,
  },
  { table: "price_history", pick: (s) => s.priceHistory, key: (v) => (v as { id: string }).id },
  { table: "invoices", pick: (s) => s.invoices, key: (v) => (v as { id: string }).id },
  { table: "purchase_orders", pick: (s) => s.purchaseOrders, key: (v) => (v as { id: string }).id },
  { table: "audit_log", pick: (s) => s.audit, key: (v) => (v as { id: string }).id },
];

/** Computes the row-level changes needed to bring the server from `prev` to `next`. Returns null when nothing changed. */
export function diffState(prev: AppState, next: AppState): SyncRequest | null {
  const req: SyncRequest = { upserts: {}, deletes: {} };
  let changed = false;

  for (const c of COLLECTIONS) {
    const before = c.pick(prev);
    const after = c.pick(next);
    if (before === after) continue;
    const beforeMap = new Map<string, string>();
    for (const item of before) beforeMap.set(c.key(item), JSON.stringify(item));
    const upserts: unknown[] = [];
    const seen = new Set<string>();
    for (const item of after) {
      const k = c.key(item);
      seen.add(k);
      const json = JSON.stringify(item);
      if (beforeMap.get(k) !== json) upserts.push(item);
    }
    const deletes = c.table === "audit_log" ? [] : [...beforeMap.keys()].filter((k) => !seen.has(k));
    if (upserts.length > 0) {
      req.upserts[c.table] = upserts;
      changed = true;
    }
    if (deletes.length > 0) {
      req.deletes[c.table] = deletes;
      changed = true;
    }
  }

  const settings: NonNullable<SyncRequest["settings"]> = {};
  if (prev.restaurantName !== next.restaurantName) settings.restaurantName = next.restaurantName;
  if (JSON.stringify(prev.orderOverrides) !== JSON.stringify(next.orderOverrides)) settings.orderOverrides = next.orderOverrides;
  if (JSON.stringify(prev.routing) !== JSON.stringify(next.routing)) settings.routing = next.routing;
  if (Object.keys(settings).length > 0) {
    req.settings = settings;
    changed = true;
  }

  return changed ? req : null;
}
