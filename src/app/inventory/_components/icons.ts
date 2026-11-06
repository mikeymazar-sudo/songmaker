import {
  ClipboardCheck,
  Package,
  PackageCheck,
  Pencil,
  Refrigerator,
  Send,
  Snowflake,
  Warehouse,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { ActivityKind, Area } from "../_lib/data";

export const AREA_ICON: Record<Area, LucideIcon> = {
  "Walk-in Cooler": Refrigerator,
  Freezer: Snowflake,
  "Dry Storage": Warehouse,
  Bar: Wine,
};

export const ACTIVITY_ICON: Record<ActivityKind, LucideIcon> = {
  count: ClipboardCheck,
  order: Send,
  received: PackageCheck,
  adjust: Pencil,
  item: Package,
};
