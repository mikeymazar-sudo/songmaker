import type { Metadata } from "next";
import { VendorOrdersPage } from "@/components/orders/VendorOrdersPage";

export const metadata: Metadata = { title: "Order" };

export default function Page() {
  return <VendorOrdersPage />;
}
