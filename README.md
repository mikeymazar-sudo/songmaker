# SmartPurchasing AI

Restaurant purchasing and ordering app: upload supplier invoices, keep one master product list, compare vendors on landed cost, and build each week's order with a tap-friendly walk-in count.

Data lives in a Supabase Postgres database behind the app's own API routes. The browser never talks to Supabase directly: the Next.js server holds a key that unlocks row level security, and the owner signs in with a passcode. Invoice reading uses Claude (Anthropic API) with structured output when an API key is configured; otherwise uploads fall back to a clearly labelled simulation.

## Screens

The layout is phone-first: five bottom tabs on phones, top tabs from tablet width up. Graphs and History live in the menu.

| Route | Tab | What it does |
| --- | --- | --- |
| `/` | Home | This week's order total, shortcuts to count stock and scan an invoice, what is waiting on the owner, price changes, 30-day spend |
| `/order` | Count | Walk-in count: +/− for on-hand on every item, running total; tap an item for par, order quantity and vendor prices |
| `/orders` | Order | Order split by vendor on landed cost, per-line vendor override, smart vs single-vendor routing, approve/text/email/copy/print POs |
| `/invoices` | Invoices | Scan or upload an invoice, see the app's self-check, fix what it flags, approve into price history |
| `/products` | Items | Searchable item list with best price (price matrix on wide screens), item sheet with vendor SKUs and price history, add/edit/archive |
| `/graphs` | Menu | Weekly spending by vendor and an item's price over time |
| `/audit` | Menu | Every count, correction, approval and price change, filterable and exportable as CSV |

## How an invoice is checked

The app does not trust a single reading of a photo. Every invoice goes through this before the owner sees it:

1. **Two separate reads.** The photo is sent to `/api/extract` (reads every line and matches it to the catalog) and, at the same time, to `/api/extract/verify` (a second reader that sees only the photo and copies the numbers off the page). Neither sees the other's work.
2. **Compared in code.** `reconcileReads` in `src/lib/invoiceAudit.ts` pairs the lines of the two reads and compares quantity, price and line total. Where they differ, arithmetic decides if it can: the read whose quantity × price equals its line total wins, and after that the choice that makes the invoice add up to the total on the paper wins. Lines only one read found are added or flagged, never silently dropped.
3. **A list of checks.** `auditInvoice` reruns on every edit: two reads agree, each line multiplies out, lines + fees + tax equal the printed total, every line is matched to an item, no price moved more than 20%, the invoice is not already in the app, the date is sane, and an unprinted fee matches the vendor's usual fee.
4. **The owner sees only what is left.** Lines the checks could not settle are listed first with the reason; everything else is collapsed. Approval is blocked while an item is unmatched or a price is missing, and asks for an explicit "Approve anyway" when a check failed. The outcome of the self-check is written to History with the approval.

A photo is never filled in with made-up numbers. Without `ANTHROPIC_API_KEY` the camera button explains that reading is off; practice samples are separate and labelled.

## Practice copies

A deployment that has no database settings and is not production (a Vercel preview, or `npm run dev` without `.env.local`) runs as a practice copy: the sample data from `src/data/seed.ts`, kept in the browser's local storage, with nothing saved on a server. A strip under the header says so and has a Start over link. This is how a branch can be tried on a phone without touching the real data. Production with missing settings still shows the setup notice.

## Pricing rules

- Vendor prices are normalized to each product's base unit (case, lb, gal, each, bag, bottle, bucket).
- **Landed price** = price × (1 + percent fees for that vendor and category). Flat fees (fuel surcharges, delivery fees) are added once per vendor cart. Sales tax is estimated on the vendor's taxable categories.
- The winning vendor is the lowest landed price; the product's preferred vendor wins ties. Any line can be overridden.
- Nothing is ever sent to a vendor automatically: approving a PO records it, and Text or Email opens the phone's own app with the order filled in so the owner picks the contact and presses send.

## Setup

1. Create a Supabase project and run every file in `supabase/migrations/` against it, in order (SQL editor or the Supabase CLI).
2. Insert the server key that unlocks row level security (any long random string):
   ```sql
   insert into private.app_secrets (key, value) values ('db_key', '<random 64 hex chars>');
   ```
3. Set these environment variables (Vercel: Project → Settings → Environment Variables; locally: `.env.local`):

   | Variable | Purpose |
   | --- | --- |
   | `SUPABASE_URL` | Project URL, e.g. `https://<ref>.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_…`). Grants nothing on its own. |
   | `APP_DB_KEY` | Must equal the `db_key` row above. Server-only. |
   | `APP_SESSION_SECRET` | Random string that signs login cookies. |
   | `APP_PASSCODE` | The owner login passcode. |
   | `ANTHROPIC_API_KEY` | Turns on invoice reading. Without it the app cannot read photos at all. Each invoice costs two model calls. |

4. `npm install && npm run dev`, open http://localhost:3000. The first load seeds the database from `src/data/seed.ts`. The reset button in the header deletes everything and reseeds.

To rotate the passcode, change `APP_PASSCODE` and redeploy. To rotate the database key, update the `db_key` row and `APP_DB_KEY` together.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + PostgREST), Anthropic SDK (Claude Opus 5.5 with structured output), lucide-react, Recharts.

## How saving works

The client keeps the whole workspace in memory (a reducer). After every change it diffs the new state against the last state the server confirmed and posts only the changed rows to `/api/sync`, which upserts and deletes in foreign-key order. The header shows Saved / Saving / Save failed; failed saves retry automatically.

## Layout

```
src/app          routes (server shells), API route handlers, global styles
src/components   screens by feature, plus ui/ primitives, shell/ and auth/
src/data         seed data (types, products, vendor prices, invoices, price history)
src/lib          store (reducer + server sync), pricing engine, extraction client, formatting
src/lib/server   env, session auth, Supabase data layer (server only)
supabase         SQL migrations
```
