import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJobPosting } from "@/lib/job-bank";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("id") || "";

  if (!jobId) return NextResponse.json({ description: "" });

  const description = await getJobPosting(jobId);
  return NextResponse.json({ description });
}
