"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: "success" | "info" | "danger";
}

interface ToastApi {
  toast: (t: { title: string; description?: string; tone?: ToastItem["tone"] }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback<ToastApi["toast"]>(
    (t) => {
      counter += 1;
      const id = counter;
      setItems((xs) => [...xs, { id, title: t.title, description: t.description, tone: t.tone ?? "success" }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h)+0.5rem)] z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "sheet-in pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-2xl py-3 pl-4 pr-2 shadow-lg",
              t.tone === "danger" ? "bg-danger text-white" : "bg-brand text-brand-fg",
            )}
            role="status"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{t.title}</div>
              {t.description ? <div className="mt-0.5 text-[13px] leading-snug opacity-75">{t.description}</div> : null}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-my-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-70">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
