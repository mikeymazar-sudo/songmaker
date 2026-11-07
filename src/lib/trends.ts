import type { VendorId } from "@/data/types";
import { parseISODate, round2, toISODate } from "./format";
import type { AppState, ProductRecord } from "./models";
import { landedUnitPrice } from "./pricing";

const MAX_WEEKS = 26;

export type WeekSpend = { week: string; total: number } & Partial<Record<VendorId, number>>;

export type PriceRow = { date: string; t: number } & Partial<Record<VendorId, number>>;

export interface PriceTrend {
  product: ProductRecord;
  vendors: VendorId[];
  rows: PriceRow[];
  /** Biggest change at any one vendor, first price to latest, as a fraction. */
  move: number;
}

function mondayOf(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISODate(d);
}

/** Approved invoice totals by week and vendor. Weeks with no invoices stay in, so the time axis is honest. */
export function weeklySpend(state: AppState): WeekSpend[] {
  const byWeek = new Map<string, WeekSpend>();
  for (const invoice of state.invoices) {
    if (invoice.status !== "approved") continue;
    const week = mondayOf(invoice.date);
    const row = byWeek.get(week) ?? { week, total: 0 };
    row[invoice.vendorId] = round2((row[invoice.vendorId] ?? 0) + invoice.total);
    row.total = round2(row.total + invoice.total);
    byWeek.set(week, row);
  }
  const weeks = [...byWeek.keys()].sort();
  if (weeks.length === 0) return [];

  const first = weeks[0];
  const cursor = parseISODate(weeks[weeks.length - 1]);
  const rows: WeekSpend[] = [];
  while (rows.length < MAX_WEEKS && toISODate(cursor) >= first) {
    const week = toISODate(cursor);
    rows.push(byWeek.get(week) ?? { week, total: 0 });
    cursor.setDate(cursor.getDate() - 7);
  }
  return rows.reverse();
}

function trendFor(state: AppState, product: ProductRecord): PriceTrend | null {
  const byDate = new Map<string, PriceRow>();
  const series = new Map<VendorId, Array<{ date: string; price: number }>>();

  for (const entry of state.priceHistory) {
    if (entry.productId !== product.id || entry.priceUnit !== product.baseUnit) continue;
    const vendor = state.vendors.find((v) => v.id === entry.vendorId);
    if (!vendor) continue;
    const row = byDate.get(entry.date) ?? { date: entry.date, t: parseISODate(entry.date).getTime() };
    if (row[vendor.id] !== undefined) continue; // Two invoices on one day: history is newest first, so keep the newest.
    const price = landedUnitPrice(vendor, product.category, entry.price);
    row[vendor.id] = price;
    byDate.set(entry.date, row);
    series.set(vendor.id, [...(series.get(vendor.id) ?? []), { date: entry.date, price }]);
  }

  if (byDate.size < 2) return null;

  let move = 0;
  for (const points of series.values()) {
    const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
    const first = sorted[0].price;
    const last = sorted[sorted.length - 1].price;
    if (first > 0) move = Math.max(move, Math.abs(last - first) / first);
  }

  return {
    product,
    vendors: state.vendors.map((v) => v.id).filter((id) => series.has(id)),
    rows: [...byDate.values()].sort((a, b) => a.t - b.t),
    move,
  };
}

/** Every active item with prices on at least two dates, biggest price change first. */
export function priceTrends(state: AppState): PriceTrend[] {
  return state.products
    .filter((p) => !p.archived)
    .map((p) => trendFor(state, p))
    .filter((t): t is PriceTrend => t !== null)
    .sort((a, b) => b.move - a.move || a.product.name.localeCompare(b.product.name));
}
