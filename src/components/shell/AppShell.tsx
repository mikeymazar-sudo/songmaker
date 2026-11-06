"use client";

import {
  ChefHat,
  ClipboardCheck,
  EllipsisVertical,
  FileText,
  History,
  House,
  LogOut,
  Package,
  RotateCcw,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { routeOrder } from "@/lib/pricing";
import { useApp } from "@/lib/store";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { SyncIndicator } from "./SyncIndicator";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProcessingWatcher } from "@/components/invoices/ProcessingWatcher";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar; the rest live in the ⋮ menu. */
  tab: boolean;
}

// Ordered like the week: count, order, check deliveries in, keep prices tidy.
const NAV: NavItem[] = [
  { href: "/", label: "Home", short: "Home", icon: House, tab: true },
  { href: "/order", label: "Count stock", short: "Count", icon: ClipboardCheck, tab: true },
  { href: "/orders", label: "This week's order", short: "Order", icon: Truck, tab: true },
  { href: "/invoices", label: "Invoices", short: "Invoices", icon: FileText, tab: true },
  { href: "/products", label: "Products & prices", short: "Products", icon: Package, tab: true },
  { href: "/audit", label: "History", short: "History", icon: History, tab: false },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function MoreMenu() {
  const { reset, logout, auth } = useApp();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (auth !== "ok") return null;

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] text-text hover:bg-surface-3";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-text-2 hover:bg-surface-3"
      >
        <EllipsisVertical className="h-5 w-5" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
          <Link role="menuitem" href="/audit" className={cn(item, "lg:hidden")} onClick={() => setOpen(false)}>
            <History className="h-5 w-5 text-muted" />
            History
          </Link>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={async () => {
              setOpen(false);
              const typed = window.prompt(
                "This deletes every count, invoice and order for everyone and puts the original sample data back. Type RESET to continue.",
              );
              if (typed !== "RESET") return;
              try {
                await reset();
                toast({ title: "Sample data restored", description: "Everything is back to the original data.", tone: "info" });
              } catch (err) {
                toast({ title: "Reset failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
              }
            }}
          >
            <RotateCcw className="h-5 w-5 text-muted" />
            Start over with sample data
          </button>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut className="h-5 w-5 text-muted" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ConfigCard({ message }: { message: string | null }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-(--radius-card) border border-warning/40 bg-warning-soft px-5 py-4 text-sm text-warning">
      <div className="font-semibold">The server isn&apos;t set up yet</div>
      <div className="mt-1">{message ?? "Check the environment variables on the server."}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 rounded-lg bg-surface-3" />
      <div className="h-5 w-96 max-w-full rounded-lg bg-surface-3" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-(--radius-card) bg-surface-3" />
        ))}
      </div>
      <div className="h-72 rounded-(--radius-card) bg-surface-3" />
    </div>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg", small ? "h-9 w-9" : "h-10 w-10")}>
      <ChefHat className={small ? "h-[18px] w-[18px]" : "h-5 w-5"} />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated, auth, authMessage } = useApp();
  const ready = hydrated && auth === "ok";
  const pendingReview = ready ? state.invoices.filter((i) => i.status === "needs-review").length : 0;
  const vendorsToOrder = ready ? routeOrder(state).vendorsActive : 0;

  const badge = (href: string) => {
    if (href === "/invoices" && pendingReview > 0) return { n: pendingReview, label: "invoices to check" };
    if (href === "/orders" && vendorsToOrder > 0) return { n: vendorsToOrder, label: "vendors to order from" };
    return null;
  };

  return (
    <ToastProvider>
      <ProcessingWatcher />
      <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface-2 lg:flex">
          <div className="flex items-center gap-3 px-5 pt-6 pb-7">
            <Logo />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold text-text">SmartPurchasing</div>
              <div className="text-[13px] text-muted">Ordering made simple</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3" aria-label="Main">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              const Icon = n.icon;
              const b = badge(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                    active ? "bg-surface text-text shadow-sm ring-1 ring-border" : "text-text-2 hover:bg-surface-3 hover:text-text",
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active ? "text-text" : "text-muted")} />
                  <span className="flex-1">{n.label}</span>
                  {b ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold tabular",
                        n.href === "/invoices" ? "bg-warning-soft text-warning" : "bg-surface-3 text-text-2",
                      )}
                    >
                      {b.n}
                      <span className="sr-only"> {b.label}</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border px-5 py-4">
            <SyncIndicator showLabel />
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur md:px-6 lg:px-8">
            <div className="lg:hidden">
              <Logo small />
            </div>
            <div className="w-full max-w-xl flex-1">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <SyncIndicator className="mr-1 lg:hidden" />
              <ThemeToggle />
              <MoreMenu />
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-6 md:px-6 lg:px-10 lg:pb-12 lg:pt-8">
            {auth === "required" ? (
              <LoginScreen />
            ) : auth === "unconfigured" ? (
              <ConfigCard message={authMessage} />
            ) : ready ? (
              children
            ) : (
              <Skeleton />
            )}
          </main>

          <nav
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
            aria-label="Main"
          >
            {NAV.filter((n) => n.tab).map((n) => {
              const active = isActive(pathname, n.href);
              const Icon = n.icon;
              const b = badge(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-text" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-brand text-brand-fg",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {n.short}
                  {b && n.href === "/invoices" ? (
                    <span className="absolute left-1/2 top-1.5 ml-3 min-w-5 rounded-full bg-warning px-1 text-center text-[10px] font-bold leading-5 text-white">
                      {b.n}
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
