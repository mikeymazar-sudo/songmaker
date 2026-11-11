"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover active:opacity-80",
  secondary: "bg-surface-3 text-text hover:bg-border active:bg-border",
  outline: "border border-border-strong bg-surface text-text hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-text-2 hover:bg-surface-3 hover:text-text active:bg-surface-3",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-success text-white hover:opacity-90 dark:text-[#0a0a0a]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 gap-1.5 rounded-xl px-3.5 text-sm",
  md: "h-12 gap-2 rounded-xl px-5 text-[15px]",
  lg: "h-14 gap-2 rounded-2xl px-6 text-base",
  icon: "h-11 w-11 rounded-full p-0",
};

/** The button look, for links that should read as buttons. */
export function buttonStyles(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonStyles(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}
