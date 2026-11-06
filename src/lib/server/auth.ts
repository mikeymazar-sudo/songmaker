import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "./env";

export const SESSION_COOKIE = "sp_session";
const SESSION_DAYS = 30;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const secret = serverEnv.sessionSecret();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 86_400_000, v: 1 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = serverEnv.sessionSecret();
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
