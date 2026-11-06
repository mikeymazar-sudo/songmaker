"use client";

import { ChefHat, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useApp } from "@/lib/store";

export function LoginScreen() {
  const { login, authMessage } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    const err = await login(code.trim());
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-fg">
        <ChefHat className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-text">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Enter your passcode to open SmartPurchasing.</p>
      <form onSubmit={submit} className="mt-6 w-full space-y-3">
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="password"
            inputMode="text"
            autoComplete="current-password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Passcode"
            className="h-12! pl-10 text-base"
            aria-label="Passcode"
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {authMessage ? <p className="text-sm text-warning">{authMessage}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!code.trim()}>
          Open
        </Button>
      </form>
      <p className="mt-6 text-xs text-muted">You stay signed in on this device for 30 days. Forgot the passcode? It&apos;s the APP_PASSCODE setting on the server.</p>
    </div>
  );
}
