import type { Metadata } from "next";
import { OrdersView } from "../_components/OrdersView";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = tab === "incoming" || tab === "past" ? tab : "suggested";
  return <OrdersView key={initialTab} initialTab={initialTab} />;
}
