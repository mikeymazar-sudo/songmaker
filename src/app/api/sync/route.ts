import { forbidden, isAuthenticated, sameOrigin, unauthorized } from "@/lib/server/auth";
import { applySync, type SyncRequest } from "@/lib/server/db";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!isAuthenticated(request)) return unauthorized();
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
