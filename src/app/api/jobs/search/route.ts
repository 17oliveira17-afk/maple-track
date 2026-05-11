import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchJobs } from "@/lib/jsearch";
import { searchJobBank } from "@/lib/job-bank";

// Atlantic provinces for AIP tagging
const AIP_PROVINCES = ["NB", "NS", "PE", "NL"];
const AIP_LOCATIONS = [
  "new brunswick", "nova scotia", "prince edward island",
  "newfoundland", "labrador", "fredericton", "moncton",
  "saint john", "halifax", "dartmouth", "charlottetown",
  "st. john's", "corner brook",
];

function isAipLocation(location: string): boolean {
  const lower = (location || "").toLowerCase();
  return AIP_LOCATIONS.some((loc) => lower.includes(loc));
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("q") || "";
  const location = searchParams.get("location") || "Canada";
  const page = Number(searchParams.get("page") || "1");
  const datePosted = searchParams.get("date") || "all";

  if (!keywords.trim()) return NextResponse.json([]);

  // Search ALL of Canada via JSearch + Atlantic Job Bank in parallel
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
      provinces: AIP_PROVINCES,
      page,
    }),
  ]);

  // Normalize JSearch results — tag AIP if in Atlantic location
  const normalizedJSearch = jsearchResults.map((j) => ({
    ...j,
    program: isAipLocation(j.location) ? "AIP" : null,
  }));

  // Normalize Job Bank results — all from Atlantic = AIP eligible
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
    program: "AIP" as string | null,
  }));

  // Merge all results
  const all = [...normalizedJSearch, ...normalizedJobBank];

  // Dedupe by company+title
  const seen = new Set<string>();
  const deduped = all.filter((job) => {
    const key = `${job.company.toLowerCase().slice(0, 20)}|${job.title.toLowerCase().slice(0, 30)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(deduped);
}
