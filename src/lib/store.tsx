"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { VendorId } from "@/data/types";
import type {
  AppState,
  AuditEntry,
  ExtractedLine,
  InvoiceRecord,
  PriceHistoryEntry,
  ProductRecord,
  PurchaseOrder,
  RoutingSettings,
} from "./models";
import { buildInitialState } from "@/data/initialState";
import { routeOrder } from "./pricing";
import { fmtNum, money, nowISO, round2, signedPct, uid, unitLabel } from "./format";
import { diffState } from "./sync";

const ACTOR = "Owner";
const AUDIT_LIMIT = 800;

export type Action =
  | { type: "HYDRATE"; state: AppState }
  | { type: "RESET"; ts: string }
  | { type: "SET_ON_HAND"; productId: string; value: number; ts: string }
  | { type: "SET_PAR"; productId: string; value: number; ts: string }
  | { type: "SET_ORDER_QTY"; productId: string; value: number | null; ts: string }
  | { type: "SET_ROUTING"; patch: Partial<RoutingSettings>; ts: string }
  | { type: "SET_LINE_VENDOR"; productId: string; vendorId: VendorId | null; ts: string }
  | { type: "APPROVE_PO"; vendorIds: VendorId[] | "all"; ts: string }
  | { type: "SET_PO_STATUS"; poId: string; status: PurchaseOrder["status"]; ts: string }
  | { type: "ADD_INVOICE"; invoice: InvoiceRecord; ts: string }
  | { type: "UPDATE_INVOICE"; invoiceId: string; patch: Partial<InvoiceRecord>; ts: string; audit?: string }
  | { type: "UPDATE_INVOICE_LINE"; invoiceId: string; lineId: string; patch: Partial<ExtractedLine>; ts: string }
  | { type: "APPROVE_INVOICE"; invoiceId: string; ts: string }
  | { type: "REJECT_INVOICE"; invoiceId: string; reason?: string; ts: string }
  | { type: "UPSERT_PRODUCT"; product: ProductRecord; ts: string }
  | { type: "ARCHIVE_PRODUCT"; productId: string; archived: boolean; ts: string };

function withAudit(state: AppState, entry: Omit<AuditEntry, "id" | "actor"> & { actor?: string }): AppState {
  const full: AuditEntry = { id: uid("audit"), actor: entry.actor ?? ACTOR, ...entry };
  return { ...state, audit: [full, ...state.audit].slice(0, AUDIT_LIMIT) };
}

function patchProduct(state: AppState, productId: string, patch: Partial<ProductRecord>): AppState {
  return { ...state, products: state.products.map((p) => (p.id === productId ? { ...p, ...patch } : p)) };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "RESET": {
      const fresh = buildInitialState();
      return withAudit(fresh, {
        ts: action.ts,
        type: "system",
        summary: "Demo data reset to the original seed",
        entityType: "system",
      });
    }

    case "SET_ON_HAND": {
      const product = state.products.find((p) => p.id === action.productId);
      if (!product) return state;
      const value = Math.max(0, round2(action.value));
      if (value === product.onHand) return state;
      let next = patchProduct(state, product.id, { onHand: value });
      const last = next.audit[0];
      const summary = `On-hand count for ${product.name} set to ${fmtNum(value)} ${unitLabel(product.baseUnit)}`;
      if (
        last &&
        last.type === "inventory" &&
        last.entityId === product.id &&
        new Date(action.ts).getTime() - new Date(last.ts).getTime() < 120_000
      ) {
        next = { ...next, audit: [{ ...last, ts: action.ts, summary }, ...next.audit.slice(1)] };
        return next;
      }
      return withAudit(next, {
        ts: action.ts,
        type: "inventory",
        summary,
        details: `Was ${fmtNum(product.onHand)}. Par level ${fmtNum(product.parLevel)}.`,
        entityType: "product",
        entityId: product.id,
      });
    }

    case "SET_PAR": {
      const product = state.products.find((p) => p.id === action.productId);
      if (!product) return state;
      const value = Math.max(0, round2(action.value));
      if (value === product.parLevel) return state;
      return withAudit(patchProduct(state, product.id, { parLevel: value }), {
        ts: action.ts,
        type: "inventory",
        summary: `Par level for ${product.name} changed ${fmtNum(product.parLevel)} → ${fmtNum(value)} ${unitLabel(product.baseUnit)}`,
        entityType: "product",
        entityId: product.id,
      });
    }

    case "SET_ORDER_QTY": {
      const product = state.products.find((p) => p.id === action.productId);
      if (!product) return state;
      const overrides = { ...state.orderOverrides };
      if (action.value === null) delete overrides[product.id];
      else overrides[product.id] = Math.max(0, round2(action.value));
      return { ...state, orderOverrides: overrides };
    }

    case "SET_ROUTING": {
      const routing = { ...state.routing, ...action.patch };
      const next = { ...state, routing };
      if (action.patch.mode && action.patch.mode !== state.routing.mode) {
        return withAudit(next, {
          ts: action.ts,
          type: "order",
          summary:
            routing.mode === "smart"
              ? "Order routing set to Smart (lowest landed cost per item)"
              : `Order routing set to a single vendor: ${state.vendors.find((v) => v.id === routing.singleVendorId)?.name ?? routing.singleVendorId}`,
          entityType: "system",
        });
      }
      return next;
    }

    case "SET_LINE_VENDOR": {
      const overrides = { ...state.routing.lineOverrides };
      const product = state.products.find((p) => p.id === action.productId);
      if (action.vendorId) overrides[action.productId] = action.vendorId;
      else delete overrides[action.productId];
      const next = { ...state, routing: { ...state.routing, lineOverrides: overrides } };
      if (!product) return next;
      return withAudit(next, {
        ts: action.ts,
        type: "order",
        summary: action.vendorId
          ? `${product.name} manually routed to ${state.vendors.find((v) => v.id === action.vendorId)?.name ?? action.vendorId}`
          : `Manual vendor override cleared for ${product.name}`,
        entityType: "product",
        entityId: product.id,
      });
    }

    case "APPROVE_PO": {
      const routing = routeOrder(state);
      const carts = routing.carts.filter((c) => action.vendorIds === "all" || action.vendorIds.includes(c.vendor.id));
      if (carts.length === 0) return state;
      let next = state;
      let seq = state.purchaseOrders.length;
      const overrides = { ...state.orderOverrides };
      const newPOs: PurchaseOrder[] = [];
      for (const cart of carts) {
        seq += 1;
        const po: PurchaseOrder = {
          id: uid("po"),
          number: `PO-${String(1000 + seq)}`,
          vendorId: cart.vendor.id,
          createdAt: action.ts,
          status: "approved",
          lines: cart.lines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            sku: l.quote.sku,
            packSize: l.quote.packSize,
            qty: l.qty,
            unit: l.product.baseUnit,
            unitPrice: l.quote.price,
            total: l.merchandise,
          })),
          merchandise: cart.merchandise,
          fees: round2(cart.percentFees + cart.flatFees),
          tax: cart.tax,
          total: cart.total,
          savings: cart.savings,
        };
        newPOs.push(po);
        for (const l of cart.lines) overrides[l.product.id] = 0;
      }
      next = { ...next, purchaseOrders: [...newPOs, ...next.purchaseOrders], orderOverrides: overrides };
      for (const po of newPOs) {
        const vendor = state.vendors.find((v) => v.id === po.vendorId);
        next = withAudit(next, {
          ts: action.ts,
          type: "order",
          summary: `Purchase order ${po.number} approved for ${vendor?.name ?? po.vendorId}: ${po.lines.length} lines, ${money(po.total)}`,
          details: po.savings > 0 ? `Routing saved ${money(po.savings)} versus the highest competing quotes.` : undefined,
          entityType: "purchase-order",
          entityId: po.id,
        });
      }
      return next;
    }

    case "SET_PO_STATUS": {
      const po = state.purchaseOrders.find((p) => p.id === action.poId);
      if (!po || po.status === action.status) return state;
      const next = {
        ...state,
        purchaseOrders: state.purchaseOrders.map((p) => (p.id === po.id ? { ...p, status: action.status } : p)),
      };
      return withAudit(next, {
        ts: action.ts,
        type: "order",
        summary: `${po.number} marked as ${action.status === "sent" ? "sent to vendor" : "approved (not sent)"}`,
        entityType: "purchase-order",
        entityId: po.id,
      });
    }

    case "ADD_INVOICE": {
      const vendor = state.vendors.find((v) => v.id === action.invoice.vendorId);
      const next = { ...state, invoices: [action.invoice, ...state.invoices] };
      return withAudit(next, {
        ts: action.ts,
        type: "invoice",
        summary: `Invoice ${action.invoice.fileName ?? action.invoice.invoiceNumber} uploaded for ${vendor?.name ?? action.invoice.vendorId}`,
        details: "AI extraction started.",
        entityType: "invoice",
        entityId: action.invoice.id,
      });
    }

    case "UPDATE_INVOICE": {
      const inv = state.invoices.find((i) => i.id === action.invoiceId);
      if (!inv) return state;
      const next = {
        ...state,
        invoices: state.invoices.map((i) => (i.id === inv.id ? { ...i, ...action.patch } : i)),
      };
      if (!action.audit) return next;
      return withAudit(next, {
        ts: action.ts,
        type: "invoice",
        summary: action.audit,
        entityType: "invoice",
        entityId: inv.id,
      });
    }

    case "UPDATE_INVOICE_LINE": {
      const inv = state.invoices.find((i) => i.id === action.invoiceId);
      if (!inv) return state;
      const line = inv.lines.find((l) => l.lineId === action.lineId);
      if (!line) return state;
      const updated: ExtractedLine = { ...line, ...action.patch };
      if (action.patch.qty !== undefined || action.patch.unitPrice !== undefined) {
        updated.total = round2(updated.qty * updated.unitPrice);
      }
      const lines = inv.lines.map((l) => (l.lineId === line.lineId ? updated : l));
      const subtotal = round2(lines.filter((l) => !l.isFee).reduce((s, l) => s + l.total, 0));
      const fees = round2(lines.filter((l) => l.isFee).reduce((s, l) => s + l.total, 0));
      const total = round2(subtotal + fees + inv.tax);
      const next = {
        ...state,
        invoices: state.invoices.map((i) => (i.id === inv.id ? { ...i, lines, subtotal, fees, total } : i)),
      };
      const what: string[] = [];
      if (action.patch.qty !== undefined && action.patch.qty !== line.qty) what.push(`qty ${fmtNum(line.qty)} → ${fmtNum(updated.qty)}`);
      if (action.patch.unitPrice !== undefined && action.patch.unitPrice !== line.unitPrice)
        what.push(`price ${money(line.unitPrice)} → ${money(updated.unitPrice)}`);
      if (action.patch.productId !== undefined && action.patch.productId !== line.productId) {
        const p = state.products.find((x) => x.id === action.patch.productId);
        what.push(p ? `matched to ${p.name}` : "match cleared");
      }
      if (what.length === 0) return next;
      return withAudit(next, {
        ts: action.ts,
        type: "invoice",
        summary: `Invoice ${inv.invoiceNumber}: line "${line.description}" corrected (${what.join(", ")})`,
        entityType: "invoice",
        entityId: inv.id,
      });
    }

    case "APPROVE_INVOICE": {
      const inv = state.invoices.find((i) => i.id === action.invoiceId);
      if (!inv || inv.status === "approved") return state;
      const vendor = state.vendors.find((v) => v.id === inv.vendorId);
      let vendorProducts = [...state.vendorProducts];
      const history: PriceHistoryEntry[] = [];
      const priceChanges: string[] = [];
      let updated = 0;
      let added = 0;
      for (const line of inv.lines) {
        if (line.isFee || !line.productId) continue;
        const product = state.products.find((p) => p.id === line.productId);
        if (!product) continue;
        const newPrice = round2(line.normalizedUnitPrice ?? line.unitPrice);
        const idx = vendorProducts.findIndex((vp) => vp.productId === product.id && vp.vendorId === inv.vendorId);
        const previous = idx >= 0 ? vendorProducts[idx].price : undefined;
        if (idx >= 0) {
          vendorProducts[idx] = {
            ...vendorProducts[idx],
            price: newPrice,
            lastInvoiceDate: inv.date,
            source: "invoice",
            sku: vendorProducts[idx].sku || line.sku,
          };
          updated += 1;
        } else {
          vendorProducts.push({
            productId: product.id,
            vendorId: inv.vendorId,
            sku: line.sku,
            description: line.description,
            packSize: line.packSize,
            price: newPrice,
            priceUnit: product.baseUnit,
            lastInvoiceDate: inv.date,
            source: "invoice",
          });
          added += 1;
        }
        history.push({
          id: uid("ph"),
          productId: product.id,
          vendorId: inv.vendorId,
          price: newPrice,
          priceUnit: product.baseUnit,
          date: inv.date,
          invoiceId: inv.id,
          previousPrice: previous,
        });
        if (previous !== undefined && Math.abs(newPrice - previous) / previous > 0.005) {
          priceChanges.push(
            `${product.name} at ${vendor?.shortName ?? inv.vendorId}: ${money(previous)} → ${money(newPrice)} (${signedPct((newPrice - previous) / previous)})`,
          );
        }
      }
      vendorProducts = vendorProducts.map((vp) => ({ ...vp }));
      let next: AppState = {
        ...state,
        vendorProducts,
        priceHistory: [...history, ...state.priceHistory].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
        invoices: state.invoices.map((i) =>
          i.id === inv.id ? { ...i, status: "approved" as const, approvedAt: action.ts } : i,
        ),
      };
      next = withAudit(next, {
        ts: action.ts,
        type: "invoice",
        summary: `Invoice ${inv.invoiceNumber} from ${vendor?.name ?? inv.vendorId} approved: ${inv.lines.filter((l) => !l.isFee).length} lines, ${money(inv.total)}`,
        details: `${updated} vendor prices updated, ${added} new vendor SKUs added, ${priceChanges.length} price changes flagged.`,
        entityType: "invoice",
        entityId: inv.id,
      });
      for (const change of priceChanges) {
        next = withAudit(next, {
          ts: action.ts,
          type: "price",
          summary: `Price change: ${change}`,
          entityType: "invoice",
          entityId: inv.id,
        });
      }
      return next;
    }

    case "REJECT_INVOICE": {
      const inv = state.invoices.find((i) => i.id === action.invoiceId);
      if (!inv) return state;
      const next = {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === inv.id ? { ...i, status: "rejected" as const, rejectReason: action.reason } : i,
        ),
      };
      return withAudit(next, {
        ts: action.ts,
        type: "invoice",
        summary: `Invoice ${inv.invoiceNumber} rejected${action.reason ? `: ${action.reason}` : ""}`,
        entityType: "invoice",
        entityId: inv.id,
      });
    }

    case "UPSERT_PRODUCT": {
      const exists = state.products.some((p) => p.id === action.product.id);
      const products = exists
        ? state.products.map((p) => (p.id === action.product.id ? { ...p, ...action.product } : p))
        : [...state.products, { ...action.product, createdAt: action.ts }];
      return withAudit({ ...state, products }, {
        ts: action.ts,
        type: "product",
        summary: exists ? `Master product updated: ${action.product.name}` : `Master product created: ${action.product.name}`,
        details: `${action.product.category} · ${action.product.packSize} · compared per ${action.product.baseUnit}`,
        entityType: "product",
        entityId: action.product.id,
      });
    }

    case "ARCHIVE_PRODUCT": {
      const product = state.products.find((p) => p.id === action.productId);
      if (!product) return state;
      return withAudit(patchProduct(state, product.id, { archived: action.archived }), {
        ts: action.ts,
        type: "product",
        summary: `${product.name} ${action.archived ? "archived" : "restored"}`,
        entityType: "product",
        entityId: product.id,
      });
    }

    default:
      return state;
  }
}

export interface UiState {
  productQuery: string;
  selectedInvoiceId: string | null;
  selectedProductId: string | null;
  nonce: number;
}

export type AuthStatus = "checking" | "required" | "unconfigured" | "ok";
export type SyncStatus = "idle" | "saving" | "saved" | "error";

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
  auth: AuthStatus;
  authMessage: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  extractionEnabled: boolean;
  login: (passcode: string) => Promise<string | null>;
  logout: () => Promise<void>;
  reset: () => Promise<void>;
  reload: () => Promise<void>;
  ui: UiState;
  setUi: (patch: Partial<UiState>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

interface SyncRun {
  state: AppState;
  lastSynced: React.MutableRefObject<AppState | null>;
  inFlight: React.MutableRefObject<boolean>;
  dirty: React.MutableRefObject<boolean>;
  onStatus: (status: SyncStatus, error: string | null) => void;
  onSignedOut: () => void;
  onRetry: () => void;
}

async function runSync(run: SyncRun): Promise<void> {
  if (run.inFlight.current) {
    run.dirty.current = true;
    return;
  }
  const base = run.lastSynced.current;
  if (!base) return;
  const target = run.state;
  const req = diffState(base, target);
  if (!req) {
    run.lastSynced.current = target;
    return;
  }
  run.inFlight.current = true;
  run.onStatus("saving", null);
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (res.status === 401) {
      run.onSignedOut();
      throw new Error("Signed out");
    }
    if (!res.ok) throw new Error(await readError(res));
    run.lastSynced.current = target;
    run.onStatus("saved", null);
  } catch (err) {
    run.onStatus("error", err instanceof Error ? err.message : "Save failed");
    window.setTimeout(run.onRetry, 4000);
  } finally {
    run.inFlight.current = false;
    if (run.dirty.current) {
      run.dirty.current = false;
      run.onRetry();
    }
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => buildInitialState());
  const [hydrated, setHydrated] = useState(false);
  const [auth, setAuth] = useState<AuthStatus>("checking");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [extractionEnabled, setExtractionEnabled] = useState(false);
  const [tick, setTick] = useState(0);
  const [ui, setUiState] = useState<UiState>({ productQuery: "", selectedInvoiceId: null, selectedProductId: null, nonce: 0 });

  const lastSynced = useRef<AppState | null>(null);
  const inFlight = useRef(false);
  const dirty = useRef(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.status === 401) {
        setAuth("required");
        setAuthMessage(null);
        return;
      }
      if (!res.ok) {
        setAuth("unconfigured");
        setAuthMessage(await readError(res));
        return;
      }
      const body = (await res.json()) as { state: AppState; extraction: boolean };
      lastSynced.current = body.state;
      dispatch({ type: "HYDRATE", state: body.state });
      setExtractionEnabled(Boolean(body.extraction));
      setAuth("ok");
      setAuthMessage(null);
      setHydrated(true);
      setSyncStatus("saved");
    } catch (err) {
      setAuth("unconfigured");
      setAuthMessage(err instanceof Error ? err.message : "Could not reach the server");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(t);
  }, [reload]);

  // Incremental sync: debounce, diff against the last state the server confirmed, retry on failure.
  useEffect(() => {
    if (!hydrated || auth !== "ok") return;
    if (!lastSynced.current || state === lastSynced.current) return;
    const timer = window.setTimeout(() => {
      void runSync({
        state,
        lastSynced,
        inFlight,
        dirty,
        onStatus: (status, error) => {
          setSyncStatus(status);
          setSyncError(error);
        },
        onSignedOut: () => setAuth("required"),
        onRetry: () => setTick((t) => t + 1),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state, hydrated, auth, tick]);

  const login = useCallback(
    async (passcode: string): Promise<string | null> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) return readError(res);
      setAuth("checking");
      await reload();
      return null;
    },
    [reload],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth("required");
    setHydrated(false);
    lastSynced.current = null;
  }, []);

  const reset = useCallback(async () => {
    const res = await fetch("/api/reset", { method: "POST" });
    if (!res.ok) throw new Error(await readError(res));
    const body = (await res.json()) as { state: AppState };
    lastSynced.current = body.state;
    dispatch({ type: "HYDRATE", state: body.state });
    setSyncStatus("saved");
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      dispatch,
      hydrated,
      auth,
      authMessage,
      syncStatus,
      syncError,
      extractionEnabled,
      login,
      logout,
      reset,
      reload,
      ui,
      setUi: (patch) => setUiState((prev) => ({ ...prev, ...patch })),
    }),
    [state, hydrated, auth, authMessage, syncStatus, syncError, extractionEnabled, login, logout, reset, reload, ui],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useActions() {
  const { dispatch } = useApp();
  return useMemo(
    () => ({
      setOnHand: (productId: string, value: number) => dispatch({ type: "SET_ON_HAND", productId, value, ts: nowISO() }),
      setPar: (productId: string, value: number) => dispatch({ type: "SET_PAR", productId, value, ts: nowISO() }),
      setOrderQty: (productId: string, value: number | null) =>
        dispatch({ type: "SET_ORDER_QTY", productId, value, ts: nowISO() }),
      setRouting: (patch: Partial<RoutingSettings>) => dispatch({ type: "SET_ROUTING", patch, ts: nowISO() }),
      setLineVendor: (productId: string, vendorId: VendorId | null) =>
        dispatch({ type: "SET_LINE_VENDOR", productId, vendorId, ts: nowISO() }),
      approvePO: (vendorIds: VendorId[] | "all") => dispatch({ type: "APPROVE_PO", vendorIds, ts: nowISO() }),
      setPOStatus: (poId: string, status: PurchaseOrder["status"]) =>
        dispatch({ type: "SET_PO_STATUS", poId, status, ts: nowISO() }),
      addInvoice: (invoice: InvoiceRecord) => dispatch({ type: "ADD_INVOICE", invoice, ts: nowISO() }),
      updateInvoice: (invoiceId: string, patch: Partial<InvoiceRecord>, audit?: string) =>
        dispatch({ type: "UPDATE_INVOICE", invoiceId, patch, ts: nowISO(), audit }),
      updateInvoiceLine: (invoiceId: string, lineId: string, patch: Partial<ExtractedLine>) =>
        dispatch({ type: "UPDATE_INVOICE_LINE", invoiceId, lineId, patch, ts: nowISO() }),
      approveInvoice: (invoiceId: string) => dispatch({ type: "APPROVE_INVOICE", invoiceId, ts: nowISO() }),
      rejectInvoice: (invoiceId: string, reason?: string) =>
        dispatch({ type: "REJECT_INVOICE", invoiceId, reason, ts: nowISO() }),
      upsertProduct: (product: ProductRecord) => dispatch({ type: "UPSERT_PRODUCT", product, ts: nowISO() }),
      archiveProduct: (productId: string, archived: boolean) =>
        dispatch({ type: "ARCHIVE_PRODUCT", productId, archived, ts: nowISO() }),
    }),
    [dispatch],
  );
}
