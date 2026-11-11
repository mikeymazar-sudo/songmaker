import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import { seedIfEmpty } from "@/lib/server/db";
import { buildInitialState } from "@/data/initialState";
import { isConfigured, passcodeEnabled, practiceMode } from "@/lib/server/env";

export async function GET(request: Request) {
  if (!isAuthenticated(request)) return unauthorized();
  if (practiceMode()) {
    const now = new Date().toISOString();
    const sample = buildInitialState();
    const state = { ...sample, seededAt: now, audit: sample.audit.map((a) => ({ ...a, ts: now })) };
    return Response.json({ state, extraction: false, passcode: false, practice: true });
  }
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
