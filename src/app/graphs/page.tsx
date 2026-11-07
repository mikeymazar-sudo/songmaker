import type { Metadata } from "next";
import { GraphsPage } from "@/components/graphs/GraphsPage";

export const metadata: Metadata = { title: "Graphs" };

export default function Page() {
  return <GraphsPage />;
}
