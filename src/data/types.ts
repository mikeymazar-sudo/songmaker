export type VendorId = "cheney" | "sysco" | "usfoods" | "trs" | "boomers";

export type Category =
  | "Meat & Proteins"
  | "Frozen Foods & Bread"
  | "Dairy & Cheese"
  | "Dry Goods / Pantry / Oils"
  | "Condiments & Sauces"
  | "Paper & Packaging"
  | "Beverages"
  | "Produce"
  | "Cleaning & Chemicals";

export type Unit = "case" | "lb" | "gal" | "each" | "bag" | "bottle" | "bucket" | "pack";

export interface FeeRule {
  kind: "flat" | "percent";
  amount: number;            // dollars for flat, fraction (0.10) for percent
  label: string;             // e.g. "Fuel surcharge", "10% delivery fee"
  appliesTo: "all" | "non-produce";
}

export interface Vendor {
  id: VendorId;
  name: string;              // display name
  shortName: string;         // for badges, e.g. "Cheney"
  type: "broadline" | "cash-and-carry" | "local-runner";
  terms: string;             // e.g. "Net 7", "C.O.D.", "Prepaid"
  orderingMethod: string;    // e.g. "CBI web portal", "Text the rep"
  fees: FeeRule[];
  salesTaxRate: number;      // 0.07 if this vendor charges FL sales tax on packaging/syrups, else 0
  taxableCategories: Category[]; // categories this vendor taxes
  color: string;             // hex color for charts, e.g. "#1e40af"
}

export interface Product {
  id: string;                // slug, e.g. "stealth-fries-5-16"
  name: string;              // canonical master name
  category: Category;
  packSize: string;          // typical pack, e.g. "6 / 5 lb"
  baseUnit: Unit;            // unit prices are compared on
  parLevel: number;          // target stock in baseUnit
  onHand: number;            // current stock in baseUnit
  preferredVendorId?: VendorId;
  notes?: string;            // one short line, optional
}

export interface VendorProduct {
  productId: string;
  vendorId: VendorId;
  sku: string;               // vendor item code; if unknown use a short descriptive code like "CHENEY-5GAL-BIB"
  description: string;       // vendor's own description as printed
  packSize: string;
  price: number;             // price per priceUnit, dollars
  priceUnit: Unit;           // must equal the product's baseUnit
  lastInvoiceDate?: string;  // YYYY-MM-DD when known
  source: "invoice" | "price-sheet";
}

export interface InvoiceLine {
  sku: string;
  description: string;
  packSize: string;
  qty: number;
  unitPrice: number;
  total: number;
  productId?: string;        // master product id when mappable
  category?: Category;
  isFee?: boolean;           // true for delivery/fuel fee lines
}

export interface Invoice {
  id: string;                // slug, e.g. "cheney-01-9100711086"
  vendorId: VendorId;
  invoiceNumber: string;
  date: string;              // YYYY-MM-DD
  pages: number;
  status: "approved";
  subtotal: number;          // merchandise only
  fees: number;              // delivery + fuel
  tax: number;
  total: number;
  lines: InvoiceLine[];
  notes?: string;            // one short line, e.g. "Handwritten add-ons; unprinted 10% fee"
}

export const CATEGORIES: Category[] = [
  "Meat & Proteins",
  "Frozen Foods & Bread",
  "Dairy & Cheese",
  "Dry Goods / Pantry / Oils",
  "Condiments & Sauces",
  "Paper & Packaging",
  "Beverages",
  "Produce",
  "Cleaning & Chemicals",
];

export const UNITS: Unit[] = ["case", "lb", "gal", "each", "bag", "bottle", "bucket", "pack"];
