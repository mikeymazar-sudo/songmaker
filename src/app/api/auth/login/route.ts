import { createSessionToken, forbidden, loginAllowed, passcodeMatches, recordLoginFailure, sameOrigin, sessionCookieHeader } from "@/lib/server/auth";
import { isConfigured } from "@/lib/server/env";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!loginAllowed(request)) {
    return Response.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  if (!isConfigured().auth) {
    return Response.json({ error: "Login is not configured. Set APP_PASSCODE and APP_SESSION_SECRET." }, { status: 503 });
  }
  let passcode = "";
  try {
    const body = (await request.json()) as { passcode?: string };
    passcode = String(body.passcode ?? "");
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!passcodeMatches(passcode)) {
    recordLoginFailure(request);
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "That passcode is not right." }, { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": sessionCookieHeader(createSessionToken()) },
  });
}
