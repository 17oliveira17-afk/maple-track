import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { extensionTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { extensionCorsHeaders } from "@/lib/extension-auth";

// GET — list all tokens for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await db.query.extensionTokens.findMany({
    where: eq(extensionTokens.userId, session.user.id),
    columns: {
      id: true,
      name: true,
      lastUsedAt: true,
      createdAt: true,
      // Never return the actual token value after creation
    },
  });

  return NextResponse.json(tokens);
}

// POST — generate a new extension token
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = body.name?.trim();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Token name is required" }, { status: 400 });
  }

  // Generate a secure random token
  const token = randomBytes(32).toString("hex");

  const [created] = await db.insert(extensionTokens).values({
    userId: session.user.id,
    token,
    name,
  }).returning();

  // Return the token value ONLY on creation — it won't be shown again
  return NextResponse.json({
    id: created.id,
    name: created.name,
    token, // ← only time we return the actual token
    createdAt: created.createdAt,
  }, { status: 201 });
}

// DELETE — revoke a token
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const tokenId = body.tokenId;

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 });
  }

  // Verify it belongs to the current user
  const existing = await db.query.extensionTokens.findFirst({
    where: and(
      eq(extensionTokens.id, tokenId),
      eq(extensionTokens.userId, session.user.id),
    ),
  });

  if (!existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await db.delete(extensionTokens).where(eq(extensionTokens.id, tokenId));

  return NextResponse.json({ ok: true });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders() });
}
