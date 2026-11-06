import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import { resetAll } from "@/lib/server/db";

export async function POST(request: Request) {
  if (!isAuthenticated(request)) return unauthorized();
  try {
    const state = await resetAll();
    return Response.json({ state });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Reset failed" }, { status: 500 });
  }
}
