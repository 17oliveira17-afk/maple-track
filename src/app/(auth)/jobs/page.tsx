import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { jobApplications, jobPreferences, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveHouseholdId } from "@/lib/resolve-household";
import { JobsClient } from "./jobs-client";

export default async function JobsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) redirect("/onboarding");

  // Get all profiles in household
  const householdProfiles = await db.query.profiles.findMany({
    where: eq(profiles.householdId, householdId),
  });

  // Get preferences per profile
  const prefsAll = await db.query.jobPreferences.findMany({
    where: (t, { inArray }) =>
      inArray(t.profileId, householdProfiles.map((p) => p.id)),
  });

  // Get all applications
  const applications = await db.query.jobApplications.findMany({
    where: eq(jobApplications.householdId, householdId),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });

  const profilesWithPrefs = householdProfiles.map((p) => ({
    ...p,
    prefs: prefsAll.find((pr) => pr.profileId === p.id) || null,
  }));

  return (
    <JobsClient
      profiles={profilesWithPrefs}
      applications={applications}
      householdId={householdId}
    />
  );
}
