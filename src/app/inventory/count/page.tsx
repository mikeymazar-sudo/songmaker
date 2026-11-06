import type { Metadata } from "next";
import { CountView } from "../_components/CountView";

export const metadata: Metadata = { title: "Count stock" };

export default async function CountPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams;
  return <CountView key={area ?? ""} initialArea={area ?? null} />;
}
