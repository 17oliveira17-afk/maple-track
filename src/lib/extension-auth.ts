import { db } from "@/db";
import { extensionTokens, users } from "@/db/schema";
import { eq } from "drizzle-orm";

interface ExtensionAuthResult {
  userId: string;
  householdId: string;
}

/**
 * Authenticate extension API requests via Bearer token.
 * Mirrors the session-based auth() + resolveHouseholdId() pattern
 * but uses the extensionTokens table for token lookup.
 */
export async function extensionAuth(request: Request): Promise<ExtensionAuthResult | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Look up the token
  const tokenRecord = await db.query.extensionTokens.findFirst({
    where: eq(extensionTokens.token, token),
  });
  if (!tokenRecord) return null;

  // Get the user and their household
  const user = await db.query.users.findFirst({
    where: eq(users.id, tokenRecord.userId),
  });
  if (!user || !user.householdId) return null;

  // Update lastUsedAt (fire-and-forget)
  db.update(extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionTokens.id, tokenRecord.id))
    .then(() => {})
    .catch(() => {});

  return {
    userId: user.id,
    householdId: user.householdId,
  };
}

/**
 * CORS headers for extension API routes.
 * Allows requests from chrome-extension:// origins.
 */
export function extensionCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
