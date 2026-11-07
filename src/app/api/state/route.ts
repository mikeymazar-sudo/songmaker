import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import { seedIfEmpty } from "@/lib/server/db";
import { isConfigured, passcodeEnabled } from "@/lib/server/env";

export async function GET(request: Request) {
  if (!isAuthenticated(request)) return unauthorized();
  if (!isConfigured().db) {
    return Response.json({ error: "Database is not configured. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_DB_KEY." }, { status: 503 });
  }
  try {
    const state = await seedIfEmpty();
    return Response.json({ state, extraction: isConfigured().extraction, passcode: passcodeEnabled() });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed to load" }, { status: 500 });
  }
}
