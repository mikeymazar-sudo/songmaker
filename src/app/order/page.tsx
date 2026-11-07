import type { Metadata } from "next";
import { WalkInPage } from "@/components/order/WalkInPage";

export const metadata: Metadata = { title: "Count" };

export default function Page() {
  return <WalkInPage />;
}
