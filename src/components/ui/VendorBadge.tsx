import type { Vendor } from "@/data/types";
import { cn } from "@/lib/format";

export function VendorDot({ vendor, className }: { vendor: Vendor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: vendor.color }}
    />
  );
}

export function VendorBadge({
  vendor,
  children,
  className,
  tone = "soft",
}: {
  vendor: Vendor;
  children?: React.ReactNode;
  className?: string;
  tone?: "soft" | "solid" | "plain";
}) {
  if (tone === "solid") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold text-white", className)}
        style={{ backgroundColor: vendor.color }}
      >
        {vendor.shortName}
        {children}
      </span>
    );
  }
  if (tone === "plain") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium", className)}>
        <VendorDot vendor={vendor} />
        {vendor.shortName}
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-medium text-text-2", className)}
    >
      <VendorDot vendor={vendor} />
      {vendor.shortName}
      {children}
    </span>
  );
}
