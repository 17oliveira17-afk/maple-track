import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, jobPreferences, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extensionAuth, extensionCorsHeaders } from "@/lib/extension-auth";

// GET — return full profile data for the extension to fill forms
export async function GET(request: Request) {
  const authResult = await extensionAuth(request);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: extensionCorsHeaders(),
    });
  }

  // Get user info
  const user = await db.query.users.findFirst({
    where: eq(users.id, authResult.userId),
  });

  // Get all profiles in the household
  const householdProfiles = await db.query.profiles.findMany({
    where: eq(profiles.householdId, authResult.householdId),
  });

  // Get preferences (CV text) for each profile
  const profilesWithCv = await Promise.all(
    householdProfiles.map(async (p) => {
      const prefs = await db.query.jobPreferences.findFirst({
        where: eq(jobPreferences.profileId, p.id),
      });

      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: user?.email || "",
        isPrimaryApplicant: p.isPrimaryApplicant,
        dateOfBirth: p.dateOfBirth,
        nationality: p.nationality,
        currentCountry: p.currentCountry,
        educationLevel: p.educationLevel,
        fieldOfStudy: p.fieldOfStudy,
        yearsOfExperience: p.yearsOfExperience,
        currentOccupation: p.currentOccupation,
        nocCode: p.nocCode,
        cvText: prefs?.cvText || "",
        jobTitles: prefs?.jobTitles || [],
      };
    })
  );

  return NextResponse.json({
    userId: authResult.userId,
    householdId: authResult.householdId,
    userName: user?.name || "",
    userEmail: user?.email || "",
    profiles: profilesWithCv,
  }, { headers: extensionCorsHeaders() });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders() });
}
