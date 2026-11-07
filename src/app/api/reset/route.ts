import { forbidden, isAuthenticated, sameOrigin, unauthorized } from "@/lib/server/auth";
import { resetAll } from "@/lib/server/db";
import { passcodeEnabled } from "@/lib/server/env";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!isAuthenticated(request)) return unauthorized();
  // One request here wipes everything, so it needs a signed-in owner.
  if (!passcodeEnabled()) return Response.json({ error: "Start over is off while the app has no passcode." }, { status: 403 });
  try {
    const state = await resetAll();
    return Response.json({ state });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Reset failed" }, { status: 500 });
  }
}
