import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Category, FeeRule, Unit, Vendor, VendorId, VendorProduct } from "@/data/types";
import { buildInitialState } from "@/data/initialState";
import type { AppState, AuditEntry, InvoiceRecord, PriceHistoryEntry, ProductRecord, PurchaseOrder, RoutingSettings } from "@/lib/models";
import { serverEnv } from "./env";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  client = createClient(serverEnv.supabaseUrl(), serverEnv.supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-app-key": serverEnv.appDbKey() } },
  });
  return client;
}

// ---------- row mappers ----------

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const numOrUndef = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrUndef = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
const dateStr = (v: unknown): string => str(v).slice(0, 10);

export const toRow = {
  vendor: (v: Vendor): Row => ({
    id: v.id,
    name: v.name,
    short_name: v.shortName,
    type: v.type,
    terms: v.terms,
    ordering_method: v.orderingMethod,
    fees: v.fees,
    sales_tax_rate: v.salesTaxRate,
    taxable_categories: v.taxableCategories,
    color: v.color,
    updated_at: new Date().toISOString(),
  }),
  product: (p: ProductRecord): Row => ({
    id: p.id,
    name: p.name,
    category: p.category,
    pack_size: p.packSize,
    base_unit: p.baseUnit,
    par_level: p.parLevel,
    on_hand: p.onHand,
    preferred_vendor_id: p.preferredVendorId ?? null,
    notes: p.notes ?? null,
    archived: p.archived ?? false,
    created_at: p.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  vendorProduct: (vp: VendorProduct): Row => ({
    product_id: vp.productId,
    vendor_id: vp.vendorId,
    sku: vp.sku,
    description: vp.description,
    pack_size: vp.packSize,
    price: vp.price,
    price_unit: vp.priceUnit,
    last_invoice_date: vp.lastInvoiceDate ?? null,
    source: vp.source,
    updated_at: new Date().toISOString(),
  }),
  priceHistory: (h: PriceHistoryEntry): Row => ({
    id: h.id,
    product_id: h.productId,
    vendor_id: h.vendorId,
    price: h.price,
    price_unit: h.priceUnit,
    date: h.date,
    invoice_id: h.invoiceId ?? null,
    previous_price: h.previousPrice ?? null,
  }),
  invoice: (i: InvoiceRecord): Row => ({
    id: i.id,
    vendor_id: i.vendorId,
    invoice_number: i.invoiceNumber,
    date: i.date,
    pages: i.pages,
    status: i.status,
    subtotal: i.subtotal,
    fees: i.fees,
    tax: i.tax,
    total: i.total,
    lines: i.lines,
    source: i.source,
    extraction: i.extraction ?? "simulated",
    file_name: i.fileName ?? null,
    uploaded_at: i.uploadedAt ?? null,
    approved_at: i.approvedAt ?? null,
    confidence: i.confidence ?? null,
    reject_reason: i.rejectReason ?? null,
    notes: i.notes ?? null,
    updated_at: new Date().toISOString(),
  }),
  purchaseOrder: (po: PurchaseOrder): Row => ({
    id: po.id,
    number: po.number,
    vendor_id: po.vendorId,
    created_at: po.createdAt,
    status: po.status,
    lines: po.lines,
    merchandise: po.merchandise,
    fees: po.fees,
    tax: po.tax,
    total: po.total,
    savings: po.savings,
    updated_at: new Date().toISOString(),
  }),
  audit: (a: AuditEntry): Row => ({
    id: a.id,
    ts: a.ts,
    actor: a.actor,
    type: a.type,
    summary: a.summary,
    details: a.details ?? null,
    entity_type: a.entityType ?? null,
    entity_id: a.entityId ?? null,
  }),
};

export const fromRow = {
  vendor: (r: Row): Vendor => ({
    id: str(r.id) as VendorId,
    name: str(r.name),
    shortName: str(r.short_name),
    type: str(r.type) as Vendor["type"],
    terms: str(r.terms),
    orderingMethod: str(r.ordering_method),
    fees: (r.fees as FeeRule[]) ?? [],
    salesTaxRate: num(r.sales_tax_rate),
    taxableCategories: (r.taxable_categories as Category[]) ?? [],
    color: str(r.color),
  }),
  product: (r: Row): ProductRecord => ({
    id: str(r.id),
    name: str(r.name),
    category: str(r.category) as Category,
    packSize: str(r.pack_size),
    baseUnit: str(r.base_unit) as Unit,
    parLevel: num(r.par_level),
    onHand: num(r.on_hand),
    preferredVendorId: (strOrUndef(r.preferred_vendor_id) as VendorId | undefined) ?? undefined,
    notes: strOrUndef(r.notes),
    archived: Boolean(r.archived) || undefined,
    createdAt: strOrUndef(r.created_at),
  }),
  vendorProduct: (r: Row): VendorProduct => ({
    productId: str(r.product_id),
    vendorId: str(r.vendor_id) as VendorId,
    sku: str(r.sku),
    description: str(r.description),
    packSize: str(r.pack_size),
    price: num(r.price),
    priceUnit: str(r.price_unit) as Unit,
    lastInvoiceDate: r.last_invoice_date ? dateStr(r.last_invoice_date) : undefined,
    source: str(r.source) as VendorProduct["source"],
  }),
  priceHistory: (r: Row): PriceHistoryEntry => ({
    id: str(r.id),
    productId: str(r.product_id),
    vendorId: str(r.vendor_id) as VendorId,
    price: num(r.price),
    priceUnit: str(r.price_unit) as Unit,
    date: dateStr(r.date),
    invoiceId: strOrUndef(r.invoice_id),
    previousPrice: numOrUndef(r.previous_price),
  }),
  invoice: (r: Row): InvoiceRecord => ({
    id: str(r.id),
    vendorId: str(r.vendor_id) as VendorId,
    invoiceNumber: str(r.invoice_number),
    date: dateStr(r.date),
    pages: num(r.pages) || 1,
    status: str(r.status) as InvoiceRecord["status"],
    subtotal: num(r.subtotal),
    fees: num(r.fees),
    tax: num(r.tax),
    total: num(r.total),
    lines: (r.lines as InvoiceRecord["lines"]) ?? [],
    source: str(r.source) as InvoiceRecord["source"],
    extraction: (strOrUndef(r.extraction) as InvoiceRecord["extraction"]) ?? "simulated",
    fileName: strOrUndef(r.file_name),
    uploadedAt: strOrUndef(r.uploaded_at),
    approvedAt: strOrUndef(r.approved_at),
    confidence: numOrUndef(r.confidence),
    rejectReason: strOrUndef(r.reject_reason),
    notes: strOrUndef(r.notes),
  }),
  purchaseOrder: (r: Row): PurchaseOrder => ({
    id: str(r.id),
    number: str(r.number),
    vendorId: str(r.vendor_id) as VendorId,
    createdAt: str(r.created_at),
    status: str(r.status) as PurchaseOrder["status"],
    lines: (r.lines as PurchaseOrder["lines"]) ?? [],
    merchandise: num(r.merchandise),
    fees: num(r.fees),
    tax: num(r.tax),
    total: num(r.total),
    savings: num(r.savings),
  }),
  audit: (r: Row): AuditEntry => ({
    id: str(r.id),
    ts: str(r.ts),
    actor: str(r.actor),
    type: str(r.type) as AuditEntry["type"],
    summary: str(r.summary),
    details: strOrUndef(r.details),
    entityType: strOrUndef(r.entity_type) as AuditEntry["entityType"],
    entityId: strOrUndef(r.entity_id),
  }),
};

// ---------- load / seed / sync ----------

async function selectAll<T>(table: string, map: (r: Row) => T, order?: { column: string; ascending: boolean }): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = db().from(table).select("*").range(from, from + page - 1);
    if (order) q = q.order(order.column, { ascending: order.ascending });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const r of data ?? []) out.push(map(r as Row));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function loadState(): Promise<AppState | null> {
  const { data: settingsRows, error } = await db().from("app_settings").select("*").eq("id", "default").limit(1);
  if (error) throw new Error(`app_settings: ${error.message}`);
  const settings = (settingsRows?.[0] as Row | undefined) ?? null;
  if (!settings) return null;

  const [vendors, products, vendorProducts, priceHistory, invoices, purchaseOrders, audit] = await Promise.all([
    selectAll("vendors", fromRow.vendor),
    selectAll("products", fromRow.product, { column: "name", ascending: true }),
    selectAll("vendor_products", fromRow.vendorProduct),
    selectAll("price_history", fromRow.priceHistory, { column: "date", ascending: false }),
    selectAll("invoices", fromRow.invoice, { column: "date", ascending: false }),
    selectAll("purchase_orders", fromRow.purchaseOrder, { column: "created_at", ascending: false }),
    selectAll("audit_log", fromRow.audit, { column: "ts", ascending: false }),
  ]);

  const vendorOrder: VendorId[] = ["cheney", "sysco", "usfoods", "trs", "boomers"];
  vendors.sort((a, b) => vendorOrder.indexOf(a.id) - vendorOrder.indexOf(b.id));

  return {
    version: 1,
    seededAt: str(settings.seeded_at),
    restaurantName: str(settings.restaurant_name) || "SmartPurchasing AI",
    vendors,
    products,
    vendorProducts,
    priceHistory,
    invoices,
    purchaseOrders,
    orderOverrides: (settings.order_overrides as Record<string, number>) ?? {},
    routing: (settings.routing as RoutingSettings) ?? { mode: "smart", singleVendorId: "cheney", lineOverrides: {} },
    audit,
  };
}

async function upsertChunked(table: string, rows: Row[], onConflict?: string): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await db().from(table).upsert(chunk, onConflict ? { onConflict } : undefined);
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

export async function writeFullState(state: AppState, seededAt: string): Promise<void> {
  await upsertChunked("vendors", state.vendors.map(toRow.vendor));
  await upsertChunked("products", state.products.map(toRow.product));
  await upsertChunked("vendor_products", state.vendorProducts.map(toRow.vendorProduct), "product_id,vendor_id");
  await upsertChunked("price_history", state.priceHistory.map(toRow.priceHistory));
  await upsertChunked("invoices", state.invoices.map(toRow.invoice));
  await upsertChunked("purchase_orders", state.purchaseOrders.map(toRow.purchaseOrder));
  await upsertChunked("audit_log", state.audit.map(toRow.audit));
  const { error } = await db()
    .from("app_settings")
    .upsert({ id: "default", restaurant_name: state.restaurantName, order_overrides: state.orderOverrides, routing: state.routing, seeded_at: seededAt, updated_at: new Date().toISOString() });
  if (error) throw new Error(`app_settings upsert: ${error.message}`);
}

export async function seedIfEmpty(): Promise<AppState> {
  const existing = await loadState();
  if (existing) return existing;
  const fresh = buildInitialState();
  const seededAt = new Date().toISOString();
  fresh.seededAt = seededAt;
  fresh.audit = fresh.audit.map((a) => ({ ...a, ts: seededAt }));
  await writeFullState(fresh, seededAt);
  return (await loadState()) ?? fresh;
}

export async function resetAll(): Promise<AppState> {
  const tables = ["audit_log", "purchase_orders", "invoices", "price_history", "vendor_products", "products", "vendors", "app_settings"];
  for (const t of tables) {
    const { error } = await db().from(t).delete().neq("id", "__none__");
    if (error) throw new Error(`${t} delete: ${error.message}`);
  }
  return seedIfEmpty();
}

// ---------- incremental sync ----------

export type SyncTable = "vendors" | "products" | "vendor_products" | "price_history" | "invoices" | "purchase_orders" | "audit_log";

export interface SyncRequest {
  upserts: Partial<Record<SyncTable, unknown[]>>;
  deletes: Partial<Record<SyncTable, string[]>>;
  settings?: { restaurantName?: string; orderOverrides?: Record<string, number>; routing?: RoutingSettings };
}

const MAPPERS: Record<SyncTable, (item: never) => Row> = {
  vendors: toRow.vendor as (item: never) => Row,
  products: toRow.product as (item: never) => Row,
  vendor_products: toRow.vendorProduct as (item: never) => Row,
  price_history: toRow.priceHistory as (item: never) => Row,
  invoices: toRow.invoice as (item: never) => Row,
  purchase_orders: toRow.purchaseOrder as (item: never) => Row,
  audit_log: toRow.audit as (item: never) => Row,
};

// Order matters for foreign keys: parents before children on upsert, children before parents on delete.
const UPSERT_ORDER: SyncTable[] = ["vendors", "products", "vendor_products", "price_history", "invoices", "purchase_orders", "audit_log"];
const DELETE_ORDER: SyncTable[] = [...UPSERT_ORDER].reverse();

export async function applySync(req: SyncRequest): Promise<void> {
  for (const table of DELETE_ORDER) {
    const ids = req.deletes[table];
    if (!ids || ids.length === 0) continue;
    if (table === "vendor_products") {
      for (const key of ids) {
        const [productId, vendorId] = key.split("|");
        const { error } = await db().from(table).delete().eq("product_id", productId).eq("vendor_id", vendorId);
        if (error) throw new Error(`${table} delete: ${error.message}`);
      }
    } else {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await db().from(table).delete().in("id", ids.slice(i, i + 200));
        if (error) throw new Error(`${table} delete: ${error.message}`);
      }
    }
  }
  for (const table of UPSERT_ORDER) {
    const items = req.upserts[table];
    if (!items || items.length === 0) continue;
    const rows = items.map((item) => MAPPERS[table](item as never));
    await upsertChunked(table, rows, table === "vendor_products" ? "product_id,vendor_id" : undefined);
  }
  if (req.settings) {
    const patch: Row = { id: "default", updated_at: new Date().toISOString() };
    if (req.settings.restaurantName !== undefined) patch.restaurant_name = req.settings.restaurantName;
    if (req.settings.orderOverrides !== undefined) patch.order_overrides = req.settings.orderOverrides;
    if (req.settings.routing !== undefined) patch.routing = req.settings.routing;
    const { error } = await db().from("app_settings").upsert(patch);
    if (error) throw new Error(`app_settings upsert: ${error.message}`);
  }
}
