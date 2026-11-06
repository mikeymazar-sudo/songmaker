"use client";

import { CloudCheck, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/format";
import { useApp } from "@/lib/store";

export function SyncIndicator({ className, showLabel }: { className?: string; showLabel?: boolean }) {
  const { syncStatus, syncError, auth } = useApp();
  if (auth !== "ok") return null;
  const meta =
    syncStatus === "saving"
      ? { icon: RefreshCw, label: "Saving…", tone: "text-muted", spin: true }
      : syncStatus === "error"
        ? { icon: CloudOff, label: "Not saved yet, retrying", tone: "text-danger", spin: false }
        : { icon: CloudCheck, label: "All changes saved", tone: "text-muted", spin: false };
  const Icon = meta.icon;
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", meta.tone, className)}
      title={syncError ?? "Every change is saved to your database"}
    >
      <Icon className={cn("h-4 w-4", meta.spin && "animate-spin", syncStatus !== "error" && syncStatus !== "saving" && "text-success")} />
      <span className={showLabel ? "" : "sr-only"}>{meta.label}</span>
    </span>
  );
}
