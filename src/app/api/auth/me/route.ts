import { isAuthenticated } from "@/lib/server/auth";
import { isConfigured } from "@/lib/server/env";

export async function GET(request: Request) {
  const configured = isConfigured();
  return Response.json({ authenticated: isAuthenticated(request), configured });
}
