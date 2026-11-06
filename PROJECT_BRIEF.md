# Project brief: restaurant purchasing & ordering app

Working name: **SmartPurchasing AI** (placeholder from the ChatGPT plan; rename freely).
Sources: two AI chats the owner shared (ChatGPT "AI Restaurant Purchasing App", Gemini
"AI Platforms for Restaurant Supplier App"), read 2026-11-06. This file is the distilled
version; it deliberately leaves out vendor account numbers and the street address.

## 1. The business and the problem

- Benny's Smash Burgers, Broward County, South Florida. Owner-operated. Orders weekly.
- Five suppliers, each with different terms and fee structures:
  - **Cheney Brothers** (broadline, 2-week terms, ~$9.50 fuel surcharge, orders via the CBI portal)
  - **Sysco South Florida** (broadline, Net 7, ~$10 fuel surcharge, 7% sales tax on paper/syrups)
  - **US Foods** (broadline; only a baseline price sheet so far, no invoices uploaded yet)
  - **The Restaurant Store** (Davie; prepaid online pickup/delivery, $45 delivery fee, charges 7% tax on packaging)
  - **Boomers** (local runner, C.O.D., adds an unprinted 10% delivery fee on dry goods, handwritten line items)
- Problems seen in the real invoices: handwritten add-ons and crossed-out subtotals; the same SKU
  bought from two vendors in the same week at different prices; delivery fees that change the true
  landed cost; sales tax charged inconsistently on resale-exempt packaging; catch-weight items priced
  per lb; pack-size differences (40 lb case vs 4x10 lb) that break naive price comparisons.

The owner's own requirements, verbatim from the Gemini chat:

> "Which is the best ai platform to use to make me an app designed to help my restaurant with my
> suppliers orders, i need to be able to upload all invoices, the app should sort all items and look
> for the best deals from each vendor, i also want clean UI to help me with a master product list,
> i want to use a tablet or a 2 in 1"

> "i need you to build me a web app to handle my ordering. must be very clean UI must be very
> pleasing to the eye and easy to use. use a +- for every item, at the end of the order make
> recommendations of which vendor I should order from that week. constantly update the master
> list, audit everything you are doing. give me a visual first"

Device: tablet-first. Gemini recommended a 2-in-1 Chromebook; the ChatGPT form defaulted to a
Surface / Windows 2-in-1; an iPad was also considered. In every case it is a responsive web app
running in Chrome, used in tablet mode in the walk-in cooler and in laptop mode at the desk.

## 2. What already exists

- A Google Sheet, **"Weekly Master Vendor Comparison"**, built by Gemini from ~15 uploaded invoices
  (Oct 19 to Nov 6, 2026; ~140 line rows; roughly $23.6K of spend). Tabs:
  - *Weekly Line Items*: Invoice Date, Vendor, Vendor Item Code/SKU, Vendor Description, Pack Size,
    Total Price, Quantity Purchased, Normalized Unit Price, Mapped Master Item.
  - *Master Vendor Comparison*: ~91 master items, one price column per vendor, Cheapest, Diff $,
    Diff %. Vendor cells are date-sorted FILTER formulas that pull the newest invoice price, with the
    old baseline price as fallback.
  - *Master Order List*: Par Level, On Hand, Order Qty = max(0, Par - On Hand), Best Price, Cheapest Vendor.
  - *Vendor Item Mapping* and *Order History & Audit Log*.
- Gemini also wrote Google Apps Script for a 3-tab web app (walk-in count with +/- steppers, vendor
  dispatch carts, multi-page invoice scanner using Gemini 2.5 Flash with a strict JSON response
  schema). The chat does not show it being deployed.
- Example output: a full 87-item weekly order of ~$9.4K when routed to the cheapest vendor, with a
  claimed ~$800/week saving versus paying the highest quote.

## 3. The two proposed architectures

### ChatGPT plan ("SmartPurchasing AI")
- Stack: Lovable (React + TypeScript UI) + Supabase (Postgres, Auth, private Storage, Edge
  Functions) + Google Document AI Invoice Parser for OCR + OpenAI for product matching.
- Ten screens: Dashboard, Upload Invoices, Invoice Review, Master Products, Suppliers,
  Price Comparison, Order Suggestions, Purchase Orders, Reports, Settings.
- Thirteen tables: suppliers, invoices, invoice_items, products, supplier_products,
  product_categories, price_history, inventory, inventory_movements, purchase_orders,
  purchase_order_items, users, audit_log.
- Twelve product categories (meat & poultry, seafood, produce, dairy & eggs, frozen, dry goods,
  oils & condiments, bakery, beverages, cleaning, paper & disposables, restaurant supplies).
- Principles: never auto-merge products; match confidence plus manual approval; remember approved
  mappings; normalize units; label prices as latest invoice / historical average / verified quote /
  promo; preferred-vendor overrides; never auto-send orders; RLS; API keys server-side only.
- Six-stage roadmap: foundation and design; invoice processing; master catalog; vendor
  intelligence; purchasing recommendations; testing and launch.
- Design: white and light-gray backgrounds, deep navy accents, large touch targets, sidebar on
  desktop, collapsible nav on tablet, "premium, modern, professional".

### Gemini plan
- Stack: the Google Sheet as the database + an Apps Script web app + Gemini 2.5 Flash vision for
  OCR with a JSON response schema. Optional Glide or Lovable frontend calling the Apps Script webhook.
- Design: dark slate with amber accent, bottom tab bar, category chips, +/- steppers, vendor cards.
- Model advice: Gemini Flash for OCR (cheap, strict JSON), Claude for frontend code.

## 4. Domain rules worth keeping

- Three-tier catalog: Master Product <- Vendor SKU mapping (pack size, conversion multiplier) <-
  invoice line items (history). One master record per product regardless of vendor naming.
- Compare on a normalized base unit (lb, oz, gal, each, case). Keep case price and true unit cost separate.
- Landed cost = base price + proportional delivery/fuel fee, plus tax where it applies. Boomers'
  10% fee and The Restaurant Store's $45 delivery fee flip several "cheapest vendor" answers.
- Flag: handwritten or unprinted fees, duplicate SKUs across vendors, price changes vs last
  purchase, tax charged on resale-exempt items, catch-weight totals that do not reconcile.
- Suggested order = max(0, target stock - on hand - incoming). Owner reviews and approves; the app
  never sends orders itself.
