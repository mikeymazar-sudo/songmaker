"use client";

import { cn } from "@/lib/format";
import { useApp } from "@/lib/store";

/** Silent while everything is saved. Only speaks up while saving or when a save failed. */
export function SyncIndicator({ className }: { className?: string }) {
  const { syncStatus, syncError, auth } = useApp();
  if (auth !== "ok") return null;
  if (syncStatus !== "saving" && syncStatus !== "error") return <span role="status" className="sr-only">All changes saved</span>;
  const failed = syncStatus === "error";
  return (
    <span role="status" title={syncError ?? undefined} className={cn("whitespace-nowrap text-[13px] font-medium", failed ? "text-danger" : "text-muted", className)}>
      {failed ? "Not saved, retrying" : "Saving…"}
    </span>
  );
}
