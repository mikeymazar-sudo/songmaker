"use client";

import { ClipboardList, FileText, History, LayoutDashboard, Package, RotateCcw, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { useActions, useApp } from "@/lib/store";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProcessingWatcher } from "@/components/invoices/ProcessingWatcher";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/order", label: "Walk-in Count", short: "Count", icon: ClipboardList },
  { href: "/orders", label: "Vendor Orders", short: "Orders", icon: Truck },
  { href: "/products", label: "Master Products", short: "Products", icon: Package },
  { href: "/invoices", label: "Invoices", short: "Invoices", icon: FileText },
  { href: "/audit", label: "Audit Log", short: "Audit", icon: History },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function ResetButton() {
  const actions = useActions();
  const { toast } = useToast();
  return (
    <button
      type="button"
      title="Reset demo data"
      aria-label="Reset demo data"
      onClick={() => {
        if (window.confirm("Reset all demo data? Counts, uploads and orders made in this browser will be cleared.")) {
          actions.reset();
          toast({ title: "Demo data reset", description: "Back to the original seed data.", tone: "info" });
        }
      }}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-text-2 hover:bg-surface-3"
    >
      <RotateCcw className="h-5 w-5" />
    </button>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-lg bg-surface-3" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-(--radius-card) bg-surface-3" />
        ))}
      </div>
      <div className="h-72 rounded-(--radius-card) bg-surface-3" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated } = useApp();
  const pendingReview = hydrated ? state.invoices.filter((i) => i.status === "needs-review").length : 0;
  const current = NAV.find((n) => isActive(pathname, n.href));

  return (
    <ToastProvider>
      <ProcessingWatcher />
      <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
          <div className="flex h-16 items-center gap-2.5 px-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-fg">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-text">SmartPurchasing AI</div>
              <div className="text-[11px] text-muted">Purchasing intelligence</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-2">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    active ? "bg-brand-soft text-brand dark:text-text" : "text-text-2 hover:bg-surface-3",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{n.label}</span>
                  {n.href === "/invoices" && pendingReview > 0 ? (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                      {pendingReview}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border px-5 py-4 text-xs text-muted">
            <div className="font-medium text-text-2">Demo workspace</div>
            <div className="mt-0.5">All data lives in this browser. Use the reset button to start over.</div>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-fg">
                <Sparkles className="h-5 w-5" />
              </span>
            </div>
            <h1 className="hidden text-base font-semibold text-text md:block">{current?.label ?? "SmartPurchasing AI"}</h1>
            <div className="mx-auto w-full max-w-xl flex-1">
              <GlobalSearch />
            </div>
            <span className="hidden sm:inline-flex">
              <Badge tone="info">Demo data</Badge>
            </span>
            <ResetButton />
            <ThemeToggle />
          </header>

          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-24 pt-5 md:px-6 lg:px-8 lg:pb-8">
            {hydrated ? children : <Skeleton />}
          </main>

          <nav
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
            aria-label="Primary"
          >
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-brand dark:text-accent" : "text-muted",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {n.short}
                  {n.href === "/invoices" && pendingReview > 0 ? (
                    <span className="absolute right-[18%] top-2 rounded-full bg-warning px-1.5 text-[10px] font-bold text-white">
                      {pendingReview}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
