import type { AuditType } from "@/lib/models";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

const META: Record<AuditType, { label: string; tone: BadgeTone }> = {
  inventory: { label: "Count", tone: "info" },
  order: { label: "Order", tone: "brand" },
  invoice: { label: "Invoice", tone: "warning" },
  price: { label: "Price", tone: "danger" },
  product: { label: "Product", tone: "success" },
  system: { label: "System", tone: "neutral" },
};

export function auditTypeLabel(t: AuditType): string {
  return META[t].label;
}

export function AuditTypeBadge({ type }: { type: AuditType }) {
  const m = META[type];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
