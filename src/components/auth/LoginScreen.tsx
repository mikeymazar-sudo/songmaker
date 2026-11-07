"use client";

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
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pb-[20dvh]">
      <h1 className="text-[28px] font-semibold tracking-tight text-text">SmartPurchasing</h1>
      <p className="mt-1 text-[15px] text-muted">Enter your passcode to open it.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          aria-label="Passcode"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {authMessage ? <p className="text-sm text-warning">{authMessage}</p> : null}
        <Button type="submit" className="w-full" loading={busy} disabled={!code.trim()}>
          Open
        </Button>
      </form>
      <p className="mt-5 text-[13px] leading-snug text-muted">You stay signed in on this device for 30 days.</p>
    </div>
  );
}
