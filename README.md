# SmartPurchasing AI

Restaurant purchasing and ordering app: upload supplier invoices, keep one master product list, compare vendors on landed cost, and build each week's order with a tap-friendly walk-in count.

Data lives in a Supabase Postgres database behind the app's own API routes. The browser never talks to Supabase directly: the Next.js server holds a key that unlocks row level security, and the owner signs in with a passcode. Invoice reading uses Claude (Anthropic API) with structured output when an API key is configured; otherwise uploads fall back to a clearly labelled simulation.

## Screens

The layout is phone-first: bottom tabs on phones, top tabs from tablet width up. Invoices and History live in the menu.

| Route | Tab | What it does |
| --- | --- | --- |
| `/` | Home | This week's order total, what needs attention, order by vendor, price changes, 30-day spend |
| `/order` | Count | Walk-in count: +/− for on-hand on every item, running total; tap an item for par, order quantity and vendor prices |
| `/orders` | Order | Order split by vendor on landed cost, per-line vendor override, smart vs single-vendor routing, approve/copy/print POs |
| `/products` | Items | Searchable item list with best price (price matrix on wide screens), item sheet with vendor SKUs and price history, add/edit/archive |
| `/invoices` | Menu | Take a photo or upload, simulated or Claude extraction, check against the original, match items, approve into price history |
| `/audit` | Menu | Every count, correction, approval and price change, filterable and exportable as CSV |

## Pricing rules

- Vendor prices are normalized to each product's base unit (case, lb, gal, each, bag, bottle, bucket).
- **Landed price** = price × (1 + percent fees for that vendor and category). Flat fees (fuel surcharges, delivery fees) are added once per vendor cart. Sales tax is estimated on the vendor's taxable categories.
- The winning vendor is the lowest landed price; the product's preferred vendor wins ties. Any line can be overridden.
- Nothing is ever sent to a vendor automatically: approving a PO records it and gives you text to paste into the vendor portal.

## Setup

1. Create a Supabase project and run `supabase/migrations/20261106000000_init.sql` against it (SQL editor or the Supabase CLI).
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
   | `ANTHROPIC_API_KEY` | Optional. Enables real invoice extraction with Claude. |

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
