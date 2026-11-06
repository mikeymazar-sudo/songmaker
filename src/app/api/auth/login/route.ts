import { createSessionToken, passcodeMatches, sessionCookieHeader } from "@/lib/server/auth";
import { isConfigured } from "@/lib/server/env";

export async function POST(request: Request) {
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
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "That passcode is not right." }, { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": sessionCookieHeader(createSessionToken()) },
  });
}
