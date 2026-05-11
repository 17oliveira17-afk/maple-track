import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchJobs } from "@/lib/jsearch";
import { searchJobBank } from "@/lib/job-bank";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("q") || "";
  const location = searchParams.get("location") || "Atlantic Canada";
  const page = Number(searchParams.get("page") || "1");
  const datePosted = searchParams.get("date") || "all";

  if (!keywords.trim()) return NextResponse.json([]);

  // Search both sources in parallel
  const [jsearchResults, jobBankResults] = await Promise.all([
    searchJobs({
      query: keywords,
      location,
      page,
      country: "ca",
      datePosted,
    }),
    searchJobBank({
      keywords,
      provinces: ["NB", "NS", "PE", "NL"],
      page,
    }),
  ]);

  // Normalize Job Bank results to same shape
  const normalizedJobBank = jobBankResults.map((j) => ({
    id: `jb-${j.id}`,
    title: j.title,
    company: j.company,
    location: j.location,
    salary: j.salary,
    date: j.date,
    url: j.url,
    source: "Job Bank Canada",
    description: "",
    isRemote: false,
    employmentType: "",
  }));

  // Merge: JSearch first (broader), then Job Bank
  const all = [...jsearchResults, ...normalizedJobBank];

  // Dedupe by company+title similarity
  const seen = new Set<string>();
  const deduped = all.filter((job) => {
    const key = `${job.company.toLowerCase().slice(0, 20)}|${job.title.toLowerCase().slice(0, 30)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(deduped);
}
