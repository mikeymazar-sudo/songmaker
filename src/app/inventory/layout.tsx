import type { Metadata, Viewport } from "next";
import { AppShell } from "./_components/AppShell";
import "./inventory.css";

export const metadata: Metadata = {
  title: { default: "Inventory", template: "%s · Inventory" },
  description: "Simple restaurant inventory: see what's running low, count your stock and send orders to suppliers.",
};

export const viewport: Viewport = {
  themeColor: "#f6f5f1",
};

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
