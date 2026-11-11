import { forbidden, isAuthenticated, sameOrigin, unauthorized } from "@/lib/server/auth";
import { applySync, type SyncRequest } from "@/lib/server/db";
import { practiceMode } from "@/lib/server/env";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!isAuthenticated(request)) return unauthorized();
  // A practice copy keeps its changes in the browser. There is no database to write to.
  if (practiceMode()) return Response.json({ ok: true });
  let body: SyncRequest;
  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    await applySync({ upserts: body.upserts ?? {}, deletes: body.deletes ?? {}, settings: body.settings });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
