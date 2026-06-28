// ─────────────────────────────────────────────
// JSearch API — aggregates LinkedIn, Indeed,
// Glassdoor, ZipRecruiter, company sites
// via RapidAPI
// ─────────────────────────────────────────────

export interface JSearchJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  date: string;
  url: string;
  source: string;
  description: string;
  isRemote: boolean;
  employmentType: string;
}

const HOST = "jsearch.p.rapidapi.com";

export interface JSearchParams {
  query: string;
  location?: string;
  page?: number;
  country?: string;
  datePosted?: string; // "today" | "3days" | "week" | "month" | "all"
  remoteOnly?: boolean;
}

export async function searchJobs(params: JSearchParams): Promise<JSearchJob[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  const q = params.location
    ? `${params.query} in ${params.location}`
    : params.query;

  // Fetch multiple pages in parallel (3 pages = ~30 results)
  const pagesToFetch = [params.page || 1, (params.page || 1) + 1, (params.page || 1) + 2];

  try {
    const fetches = pagesToFetch.map(async (pg) => {
      const url = new URL("https://jsearch.p.rapidapi.com/search");
      url.searchParams.set("query", q);
      url.searchParams.set("page", String(pg));
      url.searchParams.set("num_pages", "1");
      url.searchParams.set("country", params.country || "ca");
      if (params.datePosted) url.searchParams.set("date_posted", params.datePosted);
      if (params.remoteOnly) url.searchParams.set("remote_jobs_only", "true");

      const res = await fetch(url.toString(), {
        headers: {
          "x-rapidapi-host": HOST,
          "x-rapidapi-key": apiKey,
        },
        next: { revalidate: 600 },
      });

      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    });

    const results = await Promise.all(fetches);
    const data = results.flat();

    return data.map((job: any) => ({
      id: job.job_id || String(Math.random()),
      title: job.job_title || "",
      company: job.employer_name || "",
      location: [job.job_city, job.job_state, job.job_country]
        .filter(Boolean)
        .join(", "),
      salary: formatSalary(job),
      date: job.job_posted_at_datetime_utc
        ? formatDate(job.job_posted_at_datetime_utc)
        : "",
      url: job.job_apply_link || job.job_google_link || "",
      source: job.job_publisher || "Unknown",
      description: (job.job_description || "").slice(0, 5000),
      isRemote: job.job_is_remote || false,
      employmentType: job.job_employment_type || "",
    }));
  } catch (e) {
    console.error("[JSEARCH] fetch error:", e);
    return [];
  }
}

function formatSalary(job: any): string {
  const min = job.job_min_salary;
  const max = job.job_max_salary;
  const period = job.job_salary_period || "";

  if (min && max) {
    return `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()} ${period}`;
  }
  if (min) return `$${Number(min).toLocaleString()}+ ${period}`;
  if (max) return `Up to $${Number(max).toLocaleString()} ${period}`;
  return "";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
