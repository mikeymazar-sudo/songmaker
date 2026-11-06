import type { Metadata } from "next";
import { AuditPage } from "@/components/audit/AuditPage";

export const metadata: Metadata = { title: "Audit Log" };

export default function Page() {
  return <AuditPage />;
}
