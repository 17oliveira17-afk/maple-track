import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { jobPreferences, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveHouseholdId } from "@/lib/resolve-household";

// GET — return preferences for all profiles in household
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const householdProfiles = await db.query.profiles.findMany({
    where: eq(profiles.householdId, householdId),
  });

  const allPrefs = await Promise.all(
    householdProfiles.map(async (p) => {
      const pref = await db.query.jobPreferences.findFirst({
        where: eq(jobPreferences.profileId, p.id),
      });
      return { profileId: p.id, firstName: p.firstName, cvText: pref?.cvText || "" };
    })
  );

  return NextResponse.json(allPrefs);
}

// PUT — update CV text for a specific profile
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { profileId, cvText } = body;

  if (!profileId || typeof cvText !== "string") {
    return NextResponse.json({ error: "profileId and cvText required" }, { status: 400 });
  }

  // Verify profile belongs to household
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, profileId), eq(profiles.householdId, householdId)),
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Upsert preferences
  const existing = await db.query.jobPreferences.findFirst({
    where: eq(jobPreferences.profileId, profileId),
  });

  if (existing) {
    await db.update(jobPreferences)
      .set({ cvText, updatedAt: new Date() })
      .where(eq(jobPreferences.id, existing.id));
  } else {
    await db.insert(jobPreferences).values({
      profileId,
      cvText,
    });
  }

  return NextResponse.json({ ok: true });
}
