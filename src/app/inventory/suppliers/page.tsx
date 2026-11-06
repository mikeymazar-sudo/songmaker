import type { Metadata } from "next";
import { SuppliersView } from "../_components/SuppliersView";

export const metadata: Metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return <SuppliersView />;
}
