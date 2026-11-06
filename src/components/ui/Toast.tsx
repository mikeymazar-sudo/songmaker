"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
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
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "danger" ? CircleAlert : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg",
              )}
              role="status"
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  t.tone === "success" ? "text-success" : t.tone === "danger" ? "text-danger" : "text-info",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text">{t.title}</div>
                {t.description ? <div className="mt-0.5 text-xs text-muted">{t.description}</div> : null}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded p-1 text-muted hover:bg-surface-3">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
