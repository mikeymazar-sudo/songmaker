import type { PriceHistoryEntry } from "@/lib/models";

// Older price points taken from the invoice history in the planning chats, so the demo
// starts with visible price changes. Dates are earlier than the current vendor prices.
export const extraHistory: Array<Omit<PriceHistoryEntry, "id">> = [
  { productId: "beef-shortening-tallow", vendorId: "cheney", price: 77.4, priceUnit: "case", date: "2026-10-15" },
  { productId: "jalapeno-peppers", vendorId: "boomers", price: 2.35, priceUnit: "lb", date: "2026-10-19" },
  { productId: "jalapeno-peppers", vendorId: "boomers", price: 2.5, priceUnit: "lb", date: "2026-10-26", previousPrice: 2.35 },
  { productId: "yellow-onions", vendorId: "boomers", price: 33.95, priceUnit: "bag", date: "2026-10-19" },
  { productId: "american-cheese-yellow-sliced-120ct", vendorId: "cheney", price: 57.4, priceUnit: "case", date: "2026-10-28" },
  { productId: "beyond-burger-patty-40-4-oz", vendorId: "sysco", price: 97.99, priceUnit: "case", date: "2026-10-22" },
  { productId: "universal-xpressnap-1-ply-napkin", vendorId: "trs", price: 66.49, priceUnit: "case", date: "2026-10-22" },
  { productId: "mayonnaise-extra-heavy", vendorId: "trs", price: 40.99, priceUnit: "case", date: "2026-10-15" },
  { productId: "onion-rings-beer-battered", vendorId: "sysco", price: 28.07, priceUnit: "case", date: "2026-10-22" },
  { productId: "french-fries-5-16-sc-stealth", vendorId: "cheney", price: 47.95, priceUnit: "case", date: "2026-10-14" },
];
