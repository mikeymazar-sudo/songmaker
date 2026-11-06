"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover active:scale-[0.99]",
  secondary: "bg-brand-soft text-text hover:bg-surface-3",
  outline: "border border-border-strong bg-surface text-text hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-text-2 hover:bg-surface-3 hover:text-text",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-success text-white hover:opacity-90 dark:text-[#12110f]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  icon: "h-11 w-11 p-0 rounded-xl",
  "icon-sm": "h-9 w-9 p-0 rounded-lg",
};

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
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition select-none disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
      {iconRight}
    </button>
  );
}
