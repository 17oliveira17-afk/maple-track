import { NextResponse } from "next/server";
import { db } from "@/db";
import { autoApplyLogs, jobApplications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { extensionAuth, extensionCorsHeaders } from "@/lib/extension-auth";

// POST — report auto-apply result from extension
export async function POST(request: Request) {
  const authResult = await extensionAuth(request);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: extensionCorsHeaders(),
    });
  }

  const body = await request.json();
  const { applicationId, jobUrl, site, status, errorMessage, formData } = body;

  if (!site || !status) {
    return NextResponse.json({ error: "site and status required" }, {
      status: 400,
      headers: extensionCorsHeaders(),
    });
  }

  // Validate enums
  const validSites = ["LINKEDIN", "INDEED", "JOBBANK", "OTHER"];
  const validStatuses = ["SUCCESS", "PARTIAL", "FAILED", "SKIPPED"];

  if (!validSites.includes(site)) {
    return NextResponse.json({ error: "Invalid site" }, {
      status: 400,
      headers: extensionCorsHeaders(),
    });
  }
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, {
      status: 400,
      headers: extensionCorsHeaders(),
    });
  }

  // Create the log entry
  const [log] = await db.insert(autoApplyLogs).values({
    applicationId: applicationId || null,
    userId: authResult.userId,
    site,
    status,
    errorMessage: errorMessage || null,
    formData: formData || null,
    jobUrl: jobUrl || null,
  }).returning();

  // If successful and we have an applicationId, update the job application status
  if (status === "SUCCESS" && applicationId) {
    await db.update(jobApplications)
      .set({
        status: "APPLIED",
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobApplications.id, applicationId));
  }

  return NextResponse.json({ ok: true, logId: log.id }, {
    headers: extensionCorsHeaders(),
  });
}

// GET — list recent auto-apply logs
export async function GET(request: Request) {
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");

  const authResult = await extensionAuth(request);
  if (!authResult) {
    // Fall back to session auth for web app
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conditions = [eq(autoApplyLogs.userId, session.user.id)];
    if (applicationId) {
      conditions.push(eq(autoApplyLogs.applicationId, applicationId));
    }

    const logs = await db.query.autoApplyLogs.findMany({
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
      orderBy: (t, { desc }) => [desc(t.attemptedAt)],
      limit: 50,
    });

    return NextResponse.json({ logs });
  }

  const conditions = [eq(autoApplyLogs.userId, authResult.userId)];
  if (applicationId) {
    conditions.push(eq(autoApplyLogs.applicationId, applicationId));
  }

  const logs = await db.query.autoApplyLogs.findMany({
    where: conditions.length > 1 ? and(...conditions) : conditions[0],
    orderBy: (t, { desc }) => [desc(t.attemptedAt)],
    limit: 50,
  });

  return NextResponse.json({ logs }, { headers: extensionCorsHeaders() });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders() });
}
