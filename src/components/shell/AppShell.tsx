"use client";

import {
  ChartColumn,
  ClipboardCheck,
  History,
  House,
  LogOut,
  Menu,
  Moon,
  Package,
  ReceiptText,
  RotateCcw,
  Sun,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { useApp } from "@/lib/store";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { SyncIndicator } from "./SyncIndicator";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProcessingWatcher } from "@/components/invoices/ProcessingWatcher";
import { GlobalSearch } from "./GlobalSearch";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// The weekly routine, in the order it happens. Graphs and history live in the menu.
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/order", label: "Count", icon: ClipboardCheck },
  { href: "/orders", label: "Order", icon: Truck },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/products", label: "Items", icon: Package },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function useDarkMode() {
  const dark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("sp-theme", next ? "dark" : "light");
    } catch {
      // Private mode: the choice just lasts until the page closes.
    }
  };
  return { dark, toggle };
}

function MoreMenu() {
  const { reset, logout, passcodeEnabled } = useApp();
  const { toast } = useToast();
  const { dark, toggle } = useDarkMode();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);

  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const item = "flex min-h-13 w-full items-center gap-3.5 rounded-xl px-3 text-left text-base text-text active:bg-surface-3 md:min-h-11 md:text-[15px] md:hover:bg-surface-3";
  const icon = "h-5 w-5 text-muted";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-text active:bg-surface-3 md:hover:bg-surface-3"
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {open ? (
        <>
          <button aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-40 bg-black/30 md:bg-transparent" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="sheet-in fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-12 md:w-64 md:rounded-2xl md:border md:border-border md:shadow-lg"
          >
            <div className="mx-auto mb-2 mt-0.5 h-1 w-9 rounded-full bg-border-strong md:hidden" aria-hidden />
            <Link role="menuitem" href="/graphs" className={item}>
              <ChartColumn className={icon} />
              Graphs
            </Link>
            <Link role="menuitem" href="/audit" className={item}>
              <History className={icon} />
              History
            </Link>
            <div className="mx-3 my-1 border-t border-border" />
            <button role="menuitem" type="button" className={item} onClick={toggle}>
              {dark ? <Sun className={icon} /> : <Moon className={icon} />}
              {dark ? "Light mode" : "Dark mode"}
            </button>
            {passcodeEnabled ? (
              <>
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
                  <RotateCcw className={icon} />
                  Start over with sample data
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={item}
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                >
                  <LogOut className={icon} />
                  Sign out
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ConfigNotice({ message }: { message: string | null }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-[22px] font-semibold tracking-tight text-text">The server isn&apos;t set up yet</h1>
      <p className="mt-2 text-[15px] text-muted">{message ?? "Check the environment variables on the server."}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse px-4 pt-20 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 rounded bg-surface-3" />
      <div className="mt-3 h-12 w-56 rounded-lg bg-surface-3" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-3" />
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated, auth, authMessage } = useApp();
  const ready = hydrated && auth === "ok";
  const graphs = isActive(pathname, "/graphs");
  const pendingReview = ready ? state.invoices.filter((i) => i.status === "needs-review").length : 0;

  return (
    <ToastProvider>
      <ProcessingWatcher />
      {auth === "required" ? (
        <LoginScreen />
      ) : auth === "unconfigured" ? (
        <ConfigNotice message={authMessage} />
      ) : !ready ? (
        <Skeleton />
      ) : (
        <div className="flex min-h-dvh flex-col">
          <header className={cn("no-print sticky top-0 z-30 border-b border-border bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md", graphs && "phone-landscape:hidden")}>
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 md:h-16 md:px-8">
              <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-text">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-[11px] font-bold tracking-tight text-brand-fg" aria-hidden>
                  SP
                </span>
                SmartPurchasing
              </Link>
              <nav className="ml-8 hidden h-full items-center gap-6 md:flex" aria-label="Main">
                {NAV.map((n) => {
                  const active = isActive(pathname, n.href);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-full items-center text-[15px] font-medium transition-colors",
                        active ? "text-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-text" : "text-muted hover:text-text",
                      )}
                    >
                      {n.label}
                      {n.href === "/invoices" && pendingReview > 0 ? <span className="tabular ml-1.5 text-[13px] font-medium text-warning">{pendingReview}</span> : null}
                    </Link>
                  );
                })}
              </nav>
              <div className="ml-auto flex items-center">
                <SyncIndicator className="mr-2" />
                <GlobalSearch />
                <MoreMenu />
              </div>
            </div>
          </header>

          <main
            className={cn(
              "mx-auto w-full max-w-5xl flex-1 px-4 pb-[calc(var(--tabbar-h)+2rem)] pt-6 md:px-8 md:pb-16 md:pt-10",
              graphs && "phone-landscape:max-w-none phone-landscape:pb-2 phone-landscape:pt-1",
            )}
          >
            {children}
          </main>

          <nav
            className={cn(
              "no-print fixed inset-x-0 bottom-0 z-20 grid h-[var(--tabbar-h)] grid-cols-5 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden",
              graphs && "phone-landscape:hidden",
            )}
            aria-label="Main"
          >
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-text" : "text-muted")}
                >
                  <span className="relative">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                    {n.href === "/invoices" && pendingReview > 0 ? (
                      <span className="tabular absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold leading-none text-white">
                        {pendingReview}
                        <span className="sr-only"> to check</span>
                      </span>
                    ) : null}
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </ToastProvider>
  );
}
