import { NextResponse } from "next/server";
import { db } from "@/db";
import { jobApplications, jobPreferences } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { extensionAuth, extensionCorsHeaders } from "@/lib/extension-auth";

// GET — match a job URL to saved applications, return AI content
export async function GET(request: Request) {
  const authResult = await extensionAuth(request);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: extensionCorsHeaders(),
    });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "";

  if (!url) {
    return NextResponse.json({ found: false }, { headers: extensionCorsHeaders() });
  }

  // Search for matching application in the household
  // Try exact match first, then partial match
  let app = await db.query.jobApplications.findFirst({
    where: and(
      eq(jobApplications.householdId, authResult.householdId),
      eq(jobApplications.jobUrl, url),
    ),
  });

  // If no exact match, try partial match (URL might have extra params)
  if (!app) {
    // Extract the base URL without query parameters
    const baseUrl = url.split("?")[0];
    const apps = await db.query.jobApplications.findMany({
      where: eq(jobApplications.householdId, authResult.householdId),
    });
    app = apps.find((a) =>
      a.jobUrl && (a.jobUrl.includes(baseUrl) || baseUrl.includes(a.jobUrl.split("?")[0]))
    );
  }

  if (!app) {
    return NextResponse.json({ found: false }, { headers: extensionCorsHeaders() });
  }

  // Get CV text for this profile
  const prefs = await db.query.jobPreferences.findFirst({
    where: eq(jobPreferences.profileId, app.profileId),
  });

  return NextResponse.json({
    found: true,
    applicationId: app.id,
    profileId: app.profileId,
    jobTitle: app.jobTitle,
    company: app.company,
    generatedCoverLetter: app.generatedCoverLetter || "",
    cvTips: app.cvTips || "",
    cvText: prefs?.cvText || "",
    compatibilityScore: app.compatibilityScore,
    status: app.status,
  }, { headers: extensionCorsHeaders() });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders() });
}
