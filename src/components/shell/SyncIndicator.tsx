"use client";

import { CloudCheck, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/format";
import { useApp } from "@/lib/store";

export function SyncIndicator({ className }: { className?: string }) {
  const { syncStatus, syncError, auth } = useApp();
  if (auth !== "ok") return null;
  const meta =
    syncStatus === "saving"
      ? { icon: RefreshCw, label: "Saving…", tone: "text-muted", spin: true }
      : syncStatus === "error"
        ? { icon: CloudOff, label: "Save failed, retrying", tone: "text-danger", spin: false }
        : { icon: CloudCheck, label: "Saved", tone: "text-success", spin: false };
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.tone, className)} title={syncError ?? "All changes are stored in your database"}>
      <Icon className={cn("h-4 w-4", meta.spin && "animate-spin")} />
      <span className="hidden md:inline">{meta.label}</span>
    </span>
  );
}
