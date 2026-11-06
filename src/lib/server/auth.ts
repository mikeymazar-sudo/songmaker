import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "./env";

export const SESSION_COOKIE = "sp_session";
const SESSION_DAYS = 30;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// Sessions are bound to the current passcode: changing APP_PASSCODE signs everyone out.
function signingKey(): string {
  const secret = serverEnv.sessionSecret();
  if (!secret) return "";
  return `${secret}:${createHash("sha256").update(serverEnv.appPasscode()).digest("hex")}`;
}

export function createSessionToken(): string {
  const secret = signingKey();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 86_400_000, v: 1 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = signingKey();
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function passcodeMatches(input: string): boolean {
  const expected = serverEnv.appPasscode();
  if (!expected) return false;
  const a = Buffer.from(input.normalize());
  const b = Buffer.from(expected.normalize());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function isAuthenticated(request: Request): boolean {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

export function sessionCookieHeader(token: string | null): string {
  const base = `${SESSION_COOKIE}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax; Secure`;
  return token ? `${base}; Max-Age=${SESSION_DAYS * 86_400}` : `${base}; Max-Age=0`;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** Rejects cross-site POSTs. Browsers send Sec-Fetch-Site on every request; tools that omit it are allowed through. */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function forbidden(): Response {
  return Response.json({ error: "Cross-site request blocked" }, { status: 403 });
}

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;

/** Per-instance login throttle: at most 10 failed attempts per client in 15 minutes. */
export function loginAllowed(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) return true;
  return entry.count < MAX_ATTEMPTS;
}

export function recordLoginFailure(request: Request): void {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}
