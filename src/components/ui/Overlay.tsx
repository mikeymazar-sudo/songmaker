"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/format";

export function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

function Sheet({
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border-strong md:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 md:pt-5">
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold leading-snug tracking-tight text-text">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted md:hover:bg-surface-3"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
      {footer ? (
        <div className="flex gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:justify-end [&>button]:flex-1 md:[&>button]:flex-none">
          {footer}
        </div>
      ) : (
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" aria-hidden />
      )}
    </>
  );
}

/** A bottom sheet on phones, a centered dialog on bigger screens. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useOverlay(open, onClose);
  if (!open) return null;
  const width = { sm: "md:max-w-md", md: "md:max-w-xl", lg: "md:max-w-3xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <button aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={cn("sheet-in relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface md:m-4 md:rounded-3xl", width)}>
        <Sheet onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
          {children}
        </Sheet>
      </div>
    </div>
  );
}

/** A bottom sheet on phones, a panel from the right on bigger screens. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="sheet-in relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface md:h-full md:max-h-none md:max-w-md md:rounded-none">
        <Sheet onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
          {children}
        </Sheet>
      </div>
    </div>
  );
}
