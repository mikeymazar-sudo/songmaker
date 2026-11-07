"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

const base =
  "w-full rounded-xl border border-border-strong bg-surface px-3.5 text-[15px] text-text placeholder:text-muted transition-colors focus:border-text focus:outline-none disabled:bg-surface-2 disabled:opacity-60";

export function Label({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-medium text-text-2", className)}>
      {children}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-12", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-24 py-2.5", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={cn(base, "h-12 appearance-none bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")",
        backgroundPosition: "right 0.75rem center",
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function FormRow({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1.5 text-[13px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}
