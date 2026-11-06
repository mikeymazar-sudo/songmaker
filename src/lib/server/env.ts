import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const serverEnv = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabasePublishableKey: () => required("SUPABASE_PUBLISHABLE_KEY"),
  appDbKey: () => required("APP_DB_KEY"),
  appPasscode: () => process.env.APP_PASSCODE ?? "",
  sessionSecret: () => process.env.APP_SESSION_SECRET ?? "",
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY ?? "",
};

export function isConfigured(): { db: boolean; auth: boolean; extraction: boolean } {
  return {
    db: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.APP_DB_KEY),
    auth: Boolean(process.env.APP_PASSCODE && process.env.APP_SESSION_SECRET),
    extraction: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}
