import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { jobApplications, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveHouseholdId } from "@/lib/resolve-household";
import { z } from "zod/v4";

const createSchema = z.object({
  profileId: z.string().uuid(),
  externalId: z.string().optional(),
  jobTitle: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  salary: z.string().optional(),
  jobUrl: z.string().optional(),
  jobDescription: z.string().optional(),
  isAip: z.boolean().optional(),
  status: z.enum(["SAVED", "PREPARING", "APPLIED", "VIEWED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const apps = await db.query.jobApplications.findMany({
    where: eq(jobApplications.householdId, householdId),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });

  return NextResponse.json(apps);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const data = parsed.data;

  // Verify profile belongs to household
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, data.profileId), eq(profiles.householdId, householdId)),
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Deduplicate: if an application with the same externalId + profileId already exists, return it
  if (data.externalId) {
    const existing = await db.query.jobApplications.findFirst({
      where: and(
        eq(jobApplications.externalId, data.externalId),
        eq(jobApplications.profileId, data.profileId),
      ),
    });
    if (existing) return NextResponse.json(existing, { status: 200 });
  }

  const [app] = await db.insert(jobApplications).values({
    profileId: data.profileId,
    householdId,
    externalId: data.externalId,
    jobTitle: data.jobTitle,
    company: data.company,
    location: data.location,
    salary: data.salary,
    jobUrl: data.jobUrl,
    jobDescription: data.jobDescription,
    isAip: data.isAip ?? false,
    status: data.status ?? "SAVED",
  }).returning();

  return NextResponse.json(app, { status: 201 });
}
