import type { Metadata } from "next";
import { ProductsPage } from "@/components/products/ProductsPage";

export const metadata: Metadata = { title: "Master Products" };

export default function Page() {
  return <ProductsPage />;
}
