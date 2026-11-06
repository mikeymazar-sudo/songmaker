"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, CircleCheck, CircleX, Minus, Plus, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { STATUS_LABEL, type StockStatus } from "../_lib/data";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-300 disabled:text-stone-500",
  secondary:
    "bg-white text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 active:bg-stone-100 disabled:text-stone-400",
  ghost: "text-stone-700 hover:bg-stone-900/5 active:bg-stone-900/10 disabled:text-stone-400",
  danger: "text-red-700 hover:bg-red-50 active:bg-red-100 disabled:text-stone-400",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-11 gap-2 rounded-xl px-4 text-[15px]",
  lg: "h-12 gap-2 rounded-xl px-5 text-base",
};

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    focusRing,
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className={size === "sm" ? "size-4" : "size-[18px]"} aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon: Icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className={size === "sm" ? "size-4" : "size-[18px]"} aria-hidden />}
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={cx(
        "rounded-2xl bg-white ring-1 ring-stone-900/[0.07] shadow-[0_1px_2px_rgba(28,25,23,0.04)]",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4 px-5 pt-5 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-stone-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-stone-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-stone-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stock status                                                        */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<StockStatus, { badge: string; icon: LucideIcon; fill: string; track: string }> = {
  ok: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    icon: CircleCheck,
    fill: "bg-emerald-500",
    track: "bg-emerald-100",
  },
  low: {
    badge: "bg-amber-50 text-amber-900 ring-amber-600/25",
    icon: TriangleAlert,
    fill: "bg-amber-500",
    track: "bg-amber-100",
  },
  out: {
    badge: "bg-red-50 text-red-800 ring-red-600/20",
    icon: CircleX,
    fill: "bg-red-500",
    track: "bg-red-100",
  },
};

export function StatusBadge({ status, short }: { status: StockStatus; short?: boolean }) {
  const s = STATUS_STYLE[status];
  const label = short ? { ok: "In stock", low: "Low", out: "Out" }[status] : STATUS_LABEL[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-2 text-[13px] font-medium whitespace-nowrap ring-1 ring-inset",
        s.badge,
      )}
    >
      <s.icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** A thin bar showing on-hand stock against the par level. */
export function StockMeter({
  onHand,
  par,
  status,
  className,
}: {
  onHand: number;
  par: number;
  status: StockStatus;
  className?: string;
}) {
  const pct = par > 0 ? Math.min(1, Math.max(0, onHand / par)) : onHand > 0 ? 1 : 0;
  const s = STATUS_STYLE[status];
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full", s.track, className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={par}
      aria-valuenow={onHand}
      aria-label="Stock level compared to par"
    >
      <div className={cx("h-full rounded-full", s.fill)} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export const inputClass =
  "h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] text-stone-900 placeholder:text-stone-400 transition-colors hover:border-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 focus:outline-none";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[13px] leading-snug text-stone-500">{hint}</p>}
    </div>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input type="text" {...props} className={cx(inputClass, props.className)} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className={cx("relative", className)}>
      <select {...rest} className={cx(inputClass, "appearance-none pr-10")}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500"
        aria-hidden
      />
    </div>
  );
}

function parseQty(raw: string) {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * A number box with big minus / plus buttons — easy to use with gloves on or on a phone.
 * `value` is a string so people can type freely (e.g. "1.5").
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  size = "md",
  label,
  id,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  step?: number;
  min?: number;
  size?: "md" | "lg";
  label: string;
  id?: string;
  placeholder?: string;
}) {
  const bump = (dir: 1 | -1) => {
    const current = parseQty(value) ?? 0;
    const next = Math.max(min, Math.round((current + dir * step) * 100) / 100);
    onChange(String(next));
  };
  const btn = cx(
    "flex shrink-0 items-center justify-center text-stone-700 transition-colors hover:bg-stone-100 active:bg-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent",
    focusRing,
    size === "lg" ? "size-12" : "size-11",
  );
  const current = parseQty(value);
  return (
    <div
      className={cx(
        "inline-flex items-stretch overflow-hidden rounded-xl border border-stone-300 bg-white focus-within:border-stone-900 focus-within:ring-2 focus-within:ring-stone-900/10",
      )}
    >
      <button
        type="button"
        className={cx(btn, "border-r border-stone-200")}
        onClick={() => bump(-1)}
        disabled={current !== null && current <= min}
        aria-label={`Less ${label}`}
      >
        <Minus className="size-[18px]" aria-hidden />
      </button>
      <input
        id={id}
        inputMode="decimal"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        onFocus={(e) => e.currentTarget.select()}
        className={cx(
          "w-16 min-w-0 bg-transparent text-center font-semibold text-stone-900 tabular-nums placeholder:font-normal placeholder:text-stone-400 focus:outline-none",
          size === "lg" ? "text-lg" : "text-base",
        )}
      />
      <button
        type="button"
        className={cx(btn, "border-l border-stone-200")}
        onClick={() => bump(1)}
        aria-label={`More ${label}`}
      >
        <Plus className="size-[18px]" aria-hidden />
      </button>
    </div>
  );
}

export { parseQty };

/* ------------------------------------------------------------------ */
/* Sheet (side panel) and Dialog — both use the native <dialog>        */
/* ------------------------------------------------------------------ */

function useNativeDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useNativeDialog(open);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="inv-sheet fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[460px] overflow-hidden bg-[#fbfaf8] p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/40"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cx("-mr-2 rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900", focusRing)}
              aria-label="Close"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <footer className="border-t border-stone-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useNativeDialog(open);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "inv-dialog m-auto max-h-[min(90dvh,760px)] w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/40",
        wide ? "max-w-xl" : "max-w-md",
      )}
    >
      {open && (
        <div className="flex max-h-[min(90dvh,760px)] flex-col">
          <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cx("-mt-1 -mr-2 rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900", focusRing)}
              aria-label="Close"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/70 px-5 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Small bits                                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-stone-200/70", className)} />;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-stone-900/[0.06] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
              focusRing,
              active ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-900/[0.06]" : "text-stone-600 hover:text-stone-900",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cx(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-stone-900 text-white" : "bg-stone-900/[0.07] text-stone-600",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
