import type { Metadata } from "next";
import { ItemsView } from "../_components/ItemsView";

export const metadata: Metadata = { title: "Stock list" };

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; item?: string; new?: string }>;
}) {
  const { status, item, new: isNew } = await searchParams;
  const initialStatus = status === "low" || status === "out" || status === "attention" ? status : "all";
  return (
    <ItemsView
      key={`${initialStatus}-${item ?? ""}-${isNew ?? ""}`}
      initialStatus={initialStatus}
      initialItemId={item ?? null}
      startNew={isNew === "1"}
    />
  );
}
