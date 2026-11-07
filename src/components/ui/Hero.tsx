import type { ReactNode } from "react";

/** The one number a screen is about. */
export function Hero({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <p className="text-[15px] font-medium text-muted">{label}</p>
      <p className="tabular mt-1.5 text-[44px] font-semibold leading-none tracking-tight text-text md:text-[56px]">{value}</p>
      {hint ? <p className="mt-3 text-[15px] leading-relaxed text-text-2">{hint}</p> : null}
    </div>
  );
}
