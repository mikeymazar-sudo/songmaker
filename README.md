# SmartPurchasing AI

Restaurant purchasing and ordering app: upload supplier invoices, keep one master product list, compare vendors on landed cost, and build each week's order with a tap-friendly walk-in count.

This branch is the **mock-data UI**: every screen is fully interactive, but all data lives in the browser (`localStorage`) and the invoice "AI extraction" is simulated. The screens are built so the data layer can be swapped for Supabase without changing the UI.

## Screens

| Route | What it does |
| --- | --- |
| `/` | Dashboard: 30-day spend by vendor, items below par, this week's routed order, price changes, invoices awaiting review, recent activity |
| `/order` | Walk-in Count & Order Builder: category chips, +/− steppers for on-hand and par, order qty = par − on hand, winning vendor per item |
| `/orders` | Vendor Recommendations & Purchase Orders: order split by vendor on landed cost, per-line vendor override, smart vs single-vendor routing, approve/copy/print POs |
| `/products` | Master Products: searchable price matrix (one column per vendor, cheapest highlighted, spread %), product drawer with vendor SKUs and price history, add/edit/archive |
| `/invoices` | Upload & Review Invoices: drop files or take a photo, simulated extraction, original-vs-extracted review, match or create products, approve into price history |
| `/audit` | Audit Log: every count, correction, approval and price change, filterable and exportable as CSV |

## Pricing rules

- Vendor prices are normalized to each product's base unit (case, lb, gal, each, bag, bottle, bucket).
- **Landed price** = price × (1 + percent fees for that vendor and category). Flat fees (fuel surcharges, delivery fees) are added once per vendor cart. Sales tax is estimated on the vendor's taxable categories.
- The winning vendor is the lowest landed price; the product's preferred vendor wins ties. Any line can be overridden.
- Nothing is ever sent to a vendor automatically: approving a PO records it and gives you text to paste into the vendor portal.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use the reset button in the header to return to the seed data.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react icons, Recharts. No backend yet.

## Layout

```
src/app          routes (server shells) and global styles
src/components   screens by feature, plus ui/ primitives and shell/
src/data         seed data (types, products, vendor prices, invoices, price history)
src/lib          store (reducer + persistence), pricing engine, OCR simulation, formatting
```
