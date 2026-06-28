import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { jobApplications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveHouseholdId } from "@/lib/resolve-household";
import { z } from "zod/v4";

const updateSchema = z.object({
  status: z.enum(["SAVED", "PREPARING", "APPLIED", "VIEWED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]).optional(),
  notes: z.string().optional(),
  appliedAt: z.string().optional(),
  respondedAt: z.string().optional(),
  interviewAt: z.string().optional(),
  generatedCoverLetter: z.string().optional(),
  cvTips: z.string().optional(),
  compatibilityScore: z.number().optional(),
  appliedVia: z.string().optional(),
  appliedToEmail: z.string().optional(),
});

type Ctx = { params: Promise<{ appId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const { appId } = await ctx.params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const data = parsed.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "APPLIED" && !data.appliedAt) updateData.appliedAt = new Date();
    if (data.status === "INTERVIEW") updateData.respondedAt = new Date();
  }
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.appliedAt) updateData.appliedAt = new Date(data.appliedAt);
  if (data.respondedAt) updateData.respondedAt = new Date(data.respondedAt);
  if (data.interviewAt) updateData.interviewAt = new Date(data.interviewAt);
  if (data.generatedCoverLetter) updateData.generatedCoverLetter = data.generatedCoverLetter;
  if (data.cvTips) updateData.cvTips = data.cvTips;
  if (data.compatibilityScore !== undefined) updateData.compatibilityScore = data.compatibilityScore;
  if (data.appliedVia) updateData.appliedVia = data.appliedVia;
  if (data.appliedToEmail) updateData.appliedToEmail = data.appliedToEmail;

  const [updated] = await db
    .update(jobApplications)
    .set(updateData)
    .where(and(eq(jobApplications.id, appId), eq(jobApplications.householdId, householdId)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const { appId } = await ctx.params;
  await db.delete(jobApplications).where(
    and(eq(jobApplications.id, appId), eq(jobApplications.householdId, householdId))
  );
  return NextResponse.json({ success: true });
}
