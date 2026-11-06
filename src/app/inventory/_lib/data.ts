// Types, sample data and pure helpers for the restaurant inventory app.

export const CATEGORIES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Dry Goods",
  "Frozen",
  "Beverages",
  "Supplies",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const AREAS = ["Walk-in Cooler", "Freezer", "Dry Storage", "Bar"] as const;
export type Area = (typeof AREAS)[number];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  deliveryDays: Weekday[];
  notes: string;
}

export interface Item {
  id: string;
  name: string;
  category: Category;
  area: Area;
  supplierId: string;
  /** How it is bought and counted, e.g. "case". */
  unit: string;
  /** What is inside one unit, e.g. "24 heads". Optional. */
  packSize: string;
  /** Price paid per unit. */
  cost: number;
  /** How many units you want on the shelf right after a delivery. */
  par: number;
  onHand: number;
  countedAt: number | null;
}

export interface OrderLine {
  itemId: string;
  name: string;
  unit: string;
  packSize: string;
  qty: number;
  cost: number;
}

export interface Order {
  id: string;
  supplierId: string;
  createdAt: number;
  status: "sent" | "received";
  receivedAt: number | null;
  lines: OrderLine[];
}

export type ActivityKind = "count" | "order" | "received" | "adjust" | "item";

export interface Activity {
  id: string;
  at: number;
  kind: ActivityKind;
  text: string;
}

export interface InventoryState {
  version: 1;
  restaurantName: string;
  items: Item[];
  suppliers: Supplier[];
  orders: Order[];
  activity: Activity[];
  lastCounted: Partial<Record<Area, number>>;
}

export type StockStatus = "out" | "low" | "ok";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function newId(prefix: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function stockStatus(item: Pick<Item, "onHand" | "par">): StockStatus {
  if (item.onHand <= 0) return "out";
  if (item.onHand < item.par) return "low";
  return "ok";
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  out: "Out of stock",
  low: "Running low",
  ok: "In stock",
};

/** Units already ordered from a supplier but not delivered yet. */
export function onOrderQty(itemId: string, orders: Order[]) {
  let qty = 0;
  for (const o of orders) {
    if (o.status !== "sent") continue;
    for (const l of o.lines) if (l.itemId === itemId) qty += l.qty;
  }
  return qty;
}

/** How many units to order to get back up to par (whole units only). */
export function suggestedQty(item: Item, orders: Order[]) {
  const gap = item.par - item.onHand - onOrderQty(item.id, orders);
  return gap > 0 ? Math.ceil(gap - 1e-9) : 0;
}

const IRREGULAR: Record<string, string> = {
  lb: "lb",
  oz: "oz",
  each: "each",
  ea: "ea",
  dozen: "dozen",
  doz: "doz",
  l: "L",
};

export function pluralUnit(unit: string, qty: number) {
  const u = unit.trim();
  if (!u) return "";
  if (qty === 1) return u;
  const lower = u.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  if (/(s|x|z|ch|sh)$/i.test(u)) return `${u}es`;
  if (/[^aeiou]y$/i.test(u)) return `${u.slice(0, -1)}ies`;
  return `${u}s`;
}

export function formatQty(qty: number) {
  return String(Math.round(qty * 100) / 100);
}

export function qtyWithUnit(qty: number, unit: string) {
  const u = pluralUnit(unit, qty);
  return u ? `${formatQty(qty)} ${u}` : formatQty(qty);
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const moneyRound = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(n: number, opts?: { round?: boolean }) {
  return opts?.round ? moneyRound.format(n) : money.format(n);
}

export function stockValue(items: Item[]) {
  return items.reduce((sum, i) => sum + Math.max(0, i.onHand) * i.cost, 0);
}

export function timeAgo(at: number | null | undefined, now: number) {
  if (!at) return "Never";
  const diff = Math.max(0, now - at);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

export function daysSince(at: number | null | undefined, now: number) {
  if (!at) return Infinity;
  return Math.floor((now - at) / 86_400_000);
}

const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function formatDate(at: number) {
  return dateFmt.format(at);
}

export function formatDateTime(at: number) {
  return `${dateFmt.format(at)}, ${timeFmt.format(at)}`;
}

/** The next weekday (from tomorrow on) the supplier delivers. */
export function nextDelivery(supplier: Supplier, now: number) {
  if (supplier.deliveryDays.length === 0) return null;
  const d = new Date(now);
  for (let i = 1; i <= 7; i++) {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    const wd = WEEKDAYS[(next.getDay() + 6) % 7];
    if (supplier.deliveryDays.includes(wd)) return next;
  }
  return null;
}

export function orderTotal(order: Pick<Order, "lines">) {
  return order.lines.reduce((s, l) => s + l.qty * l.cost, 0);
}

export function itemLabel(i: Pick<Item, "name" | "packSize">) {
  return i.packSize ? `${i.name} (${i.packSize})` : i.name;
}

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

type SeedItem = [
  name: string,
  category: Category,
  area: Area,
  supplierId: string,
  unit: string,
  packSize: string,
  cost: number,
  par: number,
  onHand: number,
];

const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "sup_produce",
    name: "Fresh Valley Produce",
    contact: "Maria Lopez",
    phone: "(555) 214-8890",
    email: "orders@freshvalley.example",
    deliveryDays: ["Mon", "Wed", "Fri"],
    notes: "Order by 2 pm for next-day delivery.",
  },
  {
    id: "sup_meat",
    name: "Harbor Meat & Seafood",
    contact: "Tony Russo",
    phone: "(555) 381-0042",
    email: "tony@harbormeat.example",
    deliveryDays: ["Tue", "Fri"],
    notes: "Fish is cut to order — call before 10 am.",
  },
  {
    id: "sup_metro",
    name: "Metro Foodservice",
    contact: "Dana Kim",
    phone: "(555) 760-1188",
    email: "dana.kim@metrofs.example",
    deliveryDays: ["Mon", "Thu"],
    notes: "$250 minimum order.",
  },
  {
    id: "sup_bev",
    name: "Riverside Beverage Co.",
    contact: "Sam Patel",
    phone: "(555) 902-5571",
    email: "sam@riversidebev.example",
    deliveryDays: ["Wed"],
    notes: "Kegs need 3 days notice.",
  },
  {
    id: "sup_clean",
    name: "CleanPro Supply",
    contact: "Alex Morgan",
    phone: "(555) 448-3307",
    email: "service@cleanpro.example",
    deliveryDays: ["Thu"],
    notes: "",
  },
];

const SEED_ITEMS: SeedItem[] = [
  ["Romaine lettuce", "Produce", "Walk-in Cooler", "sup_produce", "case", "24 heads", 38, 4, 1.5],
  ["Roma tomatoes", "Produce", "Walk-in Cooler", "sup_produce", "case", "25 lb", 32, 3, 3],
  ["Yellow onions", "Produce", "Dry Storage", "sup_produce", "bag", "50 lb", 28, 2, 2],
  ["Russet potatoes", "Produce", "Dry Storage", "sup_produce", "bag", "50 lb", 26, 3, 0.5],
  ["Lemons", "Produce", "Walk-in Cooler", "sup_produce", "case", "115 ct", 48, 1, 0],
  ["Avocados", "Produce", "Walk-in Cooler", "sup_produce", "case", "48 ct", 62, 2, 0.5],
  ["Fresh basil", "Produce", "Walk-in Cooler", "sup_produce", "lb", "", 14, 2, 2.5],
  ["Peeled garlic", "Produce", "Walk-in Cooler", "sup_produce", "jar", "5 lb", 22, 2, 2],
  ["Chicken breast", "Meat & Seafood", "Walk-in Cooler", "sup_meat", "case", "40 lb", 118, 3, 3.5],
  ["Ground beef 80/20", "Meat & Seafood", "Walk-in Cooler", "sup_meat", "case", "40 lb", 172, 3, 1],
  ["Sliced bacon", "Meat & Seafood", "Walk-in Cooler", "sup_meat", "case", "15 lb", 84, 2, 2],
  ["Salmon fillets", "Meat & Seafood", "Walk-in Cooler", "sup_meat", "case", "10 lb", 145, 2, 0],
  ["Shrimp 16/20", "Meat & Seafood", "Freezer", "sup_meat", "bag", "2 lb", 24, 8, 9],
  ["Pork shoulder", "Meat & Seafood", "Walk-in Cooler", "sup_meat", "case", "2 × 8 lb", 68, 2, 2],
  ["Whole milk", "Dairy & Eggs", "Walk-in Cooler", "sup_metro", "gallon", "", 4.2, 6, 7],
  ["Heavy cream", "Dairy & Eggs", "Walk-in Cooler", "sup_metro", "quart", "", 5.1, 8, 9],
  ["Unsalted butter", "Dairy & Eggs", "Walk-in Cooler", "sup_metro", "case", "36 lb", 142, 1, 0.5],
  ["Shredded mozzarella", "Dairy & Eggs", "Walk-in Cooler", "sup_metro", "bag", "5 lb", 17.5, 6, 7],
  ["Large eggs", "Dairy & Eggs", "Walk-in Cooler", "sup_metro", "case", "15 dozen", 46, 2, 2.5],
  ["Grated parmesan", "Dairy & Eggs", "Walk-in Cooler", "sup_metro", "tub", "5 lb", 38, 2, 2],
  ["All-purpose flour", "Dry Goods", "Dry Storage", "sup_metro", "bag", "50 lb", 24, 2, 2],
  ["Granulated sugar", "Dry Goods", "Dry Storage", "sup_metro", "bag", "25 lb", 19, 2, 2],
  ["Jasmine rice", "Dry Goods", "Dry Storage", "sup_metro", "bag", "25 lb", 27, 2, 2],
  ["Penne pasta", "Dry Goods", "Dry Storage", "sup_metro", "case", "20 lb", 26, 2, 3],
  ["Extra virgin olive oil", "Dry Goods", "Dry Storage", "sup_metro", "tin", "3 L", 34, 4, 1],
  ["Canola fryer oil", "Dry Goods", "Dry Storage", "sup_metro", "jug", "35 lb", 41, 3, 3],
  ["Kosher salt", "Dry Goods", "Dry Storage", "sup_metro", "box", "3 lb", 4.5, 6, 8],
  ["Coffee beans", "Dry Goods", "Dry Storage", "sup_metro", "bag", "5 lb", 58, 3, 4],
  ["French fries", "Frozen", "Freezer", "sup_metro", "case", "6 × 5 lb", 39, 4, 4],
  ["Vanilla ice cream", "Frozen", "Freezer", "sup_metro", "tub", "3 gal", 31, 2, 2],
  ["Cola syrup", "Beverages", "Bar", "sup_bev", "box", "5 gal", 96, 2, 1],
  ["Sparkling water", "Beverages", "Bar", "sup_bev", "case", "24 bottles", 22, 3, 3],
  ["House red wine", "Beverages", "Bar", "sup_bev", "case", "12 bottles", 108, 2, 2],
  ["Local IPA keg", "Beverages", "Bar", "sup_bev", "keg", "1/6 bbl", 138, 2, 0],
  ["To-go containers", "Supplies", "Dry Storage", "sup_clean", "case", "150 ct", 44, 3, 1],
  ["Paper towels", "Supplies", "Dry Storage", "sup_clean", "case", "12 rolls", 36, 2, 2],
  ["Nitrile gloves (L)", "Supplies", "Dry Storage", "sup_clean", "box", "100 ct", 9.5, 6, 7],
  ["Dish detergent", "Supplies", "Dry Storage", "sup_clean", "jug", "1 gal", 16, 3, 3],
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function createSampleState(now: number): InventoryState {
  const lastCounted: Partial<Record<Area, number>> = {
    "Walk-in Cooler": now - 1 * DAY - 3 * HOUR,
    Freezer: now - 1 * DAY - 3 * HOUR,
    "Dry Storage": now - 3 * DAY,
    Bar: now - 8 * DAY,
  };

  const items: Item[] = SEED_ITEMS.map(
    ([name, category, area, supplierId, unit, packSize, cost, par, onHand], i) => ({
      id: `item_${i + 1}`,
      name,
      category,
      area,
      supplierId,
      unit,
      packSize,
      cost,
      par,
      onHand,
      countedAt: lastCounted[area] ?? null,
    }),
  );

  const line = (itemName: string, qty: number): OrderLine => {
    const it = items.find((x) => x.name === itemName)!;
    return { itemId: it.id, name: it.name, unit: it.unit, packSize: it.packSize, qty, cost: it.cost };
  };

  const orders: Order[] = [
    {
      id: "ord_4",
      supplierId: "sup_bev",
      createdAt: now - 20 * HOUR,
      status: "sent",
      receivedAt: null,
      lines: [line("Local IPA keg", 2), line("Cola syrup", 1)],
    },
    {
      id: "ord_3",
      supplierId: "sup_produce",
      createdAt: now - 3 * DAY,
      status: "received",
      receivedAt: now - 2 * DAY,
      lines: [line("Romaine lettuce", 3), line("Roma tomatoes", 2), line("Avocados", 2), line("Fresh basil", 2)],
    },
    {
      id: "ord_2",
      supplierId: "sup_metro",
      createdAt: now - 6 * DAY,
      status: "received",
      receivedAt: now - 5 * DAY,
      lines: [
        line("All-purpose flour", 2),
        line("Unsalted butter", 1),
        line("French fries", 3),
        line("Large eggs", 2),
        line("Whole milk", 6),
      ],
    },
    {
      id: "ord_1",
      supplierId: "sup_meat",
      createdAt: now - 8 * DAY,
      status: "received",
      receivedAt: now - 7 * DAY,
      lines: [line("Chicken breast", 2), line("Ground beef 80/20", 2), line("Sliced bacon", 1)],
    },
  ];

  const activity: Activity[] = [
    { id: "act_6", at: now - 20 * HOUR, kind: "order", text: "Order sent to Riverside Beverage Co. · $372.00" },
    { id: "act_5", at: now - 1 * DAY - 3 * HOUR, kind: "count", text: "Counted Walk-in Cooler and Freezer · 20 items" },
    { id: "act_4", at: now - 2 * DAY, kind: "received", text: "Delivery from Fresh Valley Produce added to stock" },
    { id: "act_3", at: now - 3 * DAY, kind: "count", text: "Counted Dry Storage · 14 items" },
    { id: "act_2", at: now - 5 * DAY, kind: "received", text: "Delivery from Metro Foodservice added to stock" },
    { id: "act_1", at: now - 8 * DAY, kind: "count", text: "Counted Bar · 4 items" },
  ];

  return {
    version: 1,
    restaurantName: "Main Street Kitchen",
    items,
    suppliers: SEED_SUPPLIERS.map((s) => ({ ...s, deliveryDays: [...s.deliveryDays] })),
    orders,
    activity,
    lastCounted,
  };
}

export function createEmptyState(restaurantName: string): InventoryState {
  return {
    version: 1,
    restaurantName,
    items: [],
    suppliers: [],
    orders: [],
    activity: [],
    lastCounted: {},
  };
}
