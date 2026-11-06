import type { Unit } from "@/data/types";

export function cn(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(" ");
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd3 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function money(n: number): string {
  return usd.format(Number.isFinite(n) ? n : 0);
}
/** Whole dollars, for big round figures like yearly savings. */
export function moneyWhole(n: number): string {
  return usd0.format(Number.isFinite(n) ? n : 0);
}
export function money3(n: number): string {
  return usd3.format(Number.isFinite(n) ? n : 0);
}
export function fmtNum(n: number): string {
  return num.format(Number.isFinite(n) ? n : 0);
}
export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
export function signedPct(n: number, digits = 1): string {
  const s = (n * 100).toFixed(digits);
  return `${n > 0 ? "+" : ""}${s}%`;
}
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = iso.length > 10 ? new Date(iso) : parseISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
export function fmtShortDate(iso?: string): string {
  if (!iso) return "—";
  const d = iso.length > 10 ? new Date(iso) : parseISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${h}:${min} ${ampm}`;
}
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min} ${ampm}`;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(): string {
  return toISODate(new Date());
}
export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}
export function nowISO(): string {
  return new Date().toISOString();
}
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return fmtDate(iso);
}

let seq = 0;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const UNIT_LABEL: Record<Unit, string> = {
  case: "cs",
  lb: "lb",
  gal: "gal",
  each: "ea",
  bag: "bag",
  bottle: "btl",
  bucket: "bkt",
  pack: "pk",
};
export function unitLabel(u: Unit): string {
  return UNIT_LABEL[u] ?? u;
}
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtNum(n)} ${n === 1 ? one : many}`;
}
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
