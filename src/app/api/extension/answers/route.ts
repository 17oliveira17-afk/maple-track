import { NextResponse } from "next/server";
import { db } from "@/db";
import { screeningAnswers, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { extensionAuth, extensionCorsHeaders } from "@/lib/extension-auth";
import { auth } from "@/lib/auth";
import { resolveHouseholdId } from "@/lib/resolve-household";

// GET — get all screening answers
export async function GET(request: Request) {
  // Try extension auth first, then session auth
  const extAuth = await extensionAuth(request);

  let householdId: string;

  if (extAuth) {
    householdId = extAuth.householdId;
  } else {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hId = await resolveHouseholdId(session.user);
    if (!hId) return NextResponse.json({ error: "No household" }, { status: 404 });
    householdId = hId;
  }

  // Get all profiles in household
  const householdProfiles = await db.query.profiles.findMany({
    where: eq(profiles.householdId, householdId),
  });

  // Get answers for all profiles
  const allAnswers = await Promise.all(
    householdProfiles.map(async (p) => {
      const answers = await db.query.screeningAnswers.findMany({
        where: eq(screeningAnswers.profileId, p.id),
      });
      return {
        profileId: p.id,
        firstName: p.firstName,
        answers,
      };
    })
  );

  const headers = extAuth ? extensionCorsHeaders() : {};
  return NextResponse.json(allAnswers, { headers });
}

// POST — create/update screening answers (batch)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { profileId, answers } = body;

  if (!profileId || !Array.isArray(answers)) {
    return NextResponse.json({ error: "profileId and answers[] required" }, { status: 400 });
  }

  // Verify profile belongs to household
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, profileId), eq(profiles.householdId, householdId)),
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Delete existing answers for this profile and insert new ones
  await db.delete(screeningAnswers).where(eq(screeningAnswers.profileId, profileId));

  if (answers.length > 0) {
    const validCategories = [
      "WORK_AUTHORIZATION", "EXPERIENCE", "EDUCATION",
      "LANGUAGES", "AVAILABILITY", "SALARY", "RELOCATION", "OTHER",
    ];

    const validAnswers = answers
      .filter((a: { question?: string; answer?: string; category?: string }) =>
        a.question?.trim() && a.answer?.trim() && validCategories.includes(a.category || "")
      )
      .map((a: { question: string; answer: string; category: string }) => ({
        profileId,
        question: a.question.trim(),
        answer: a.answer.trim(),
        category: a.category as "WORK_AUTHORIZATION" | "EXPERIENCE" | "EDUCATION" | "LANGUAGES" | "AVAILABILITY" | "SALARY" | "RELOCATION" | "OTHER",
      }));

    if (validAnswers.length > 0) {
      await db.insert(screeningAnswers).values(validAnswers);
    }
  }

  return NextResponse.json({ ok: true, count: answers.length });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders() });
}
