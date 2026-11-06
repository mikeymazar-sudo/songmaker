This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Restaurant inventory app (`/inventory`)

A simple inventory tool for restaurant owners, built at [http://localhost:3000/inventory](http://localhost:3000/inventory). It loads a sample restaurant the first time it opens.

- **Overview** – what needs attention today, stock value, what's ready to order, deliveries on the way and which storage areas are due for a count.
- **Inventory** – every item with its stock level against par, searchable and filterable by status, category and storage area. Tap an item to edit it.
- **Count stock** – walk one storage area at a time and enter what's on the shelf with large +/− buttons.
- **Orders** – suggested orders per supplier that bring every item back to par, a ready-to-send message (copy, email or text), and check-in for deliveries.
- **Suppliers** – contacts, delivery days and notes.

Data is saved in the browser's localStorage. Settings (gear icon) lets you rename the restaurant, reload the sample data or start from scratch. Most changes can be undone from the toast that appears afterwards.

Code lives in `src/app/inventory/`: `_lib/` holds the data model and store, `_components/` holds the screens and shared UI.
