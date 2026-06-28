// ─────────────────────────────────────────────
// Job Bank Canada — server-side scraper
// Searches jobbank.gc.ca and returns structured jobs
// ─────────────────────────────────────────────

export interface JobBankListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  date: string;
  url: string;
  isDirectApply: boolean;
  source: string;
}

const BASE = "https://www.jobbank.gc.ca";

function parseListings(html: string): JobBankListing[] {
  const jobs: JobBankListing[] = [];

  // Extract each article block
  const articleRegex =
    /<article id="article-(\d+)"[^>]*>([\s\S]*?)<\/article>/g;
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(html)) !== null) {
    const id = match[1];
    const body = match[2];

    const title = extractText(body, /class="noctitle"[^>]*>([\s\S]*?)<\/span>/);
    const company = extractText(body, /<li class="business">([\s\S]*?)<\/li>/);
    const location = extractText(
      body,
      /class="wb-inv">Location<\/span>\s*([\s\S]*?)<\/li>/
    );
    const salary = extractText(
      body,
      /class="salary"[^>]*>[\s\S]*?Salary\s*([\s\S]*?)<\/li>/
    );
    const date = extractText(body, /<li class="date">([\s\S]*?)<\/li>/);
    const isDirectApply = body.includes("Direct Apply");

    if (title && company) {
      jobs.push({
        id,
        title: clean(title),
        company: clean(company),
        location: clean(location),
        salary: clean(salary),
        date: clean(date),
        url: `${BASE}/jobsearch/jobposting/${id}`,
        isDirectApply,
        source: "Job Bank Canada",
      });
    }
  }

  return jobs;
}

function extractText(html: string, regex: RegExp): string {
  const m = html.match(regex);
  if (!m) return "";
  return m[1] || "";
}

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface JobSearchParams {
  keywords: string;
  provinces?: string[]; // e.g. ["NB","NS","PE","NL"]
  page?: number;
}

export async function searchJobBank(
  params: JobSearchParams
): Promise<JobBankListing[]> {
  const provinces =
    params.provinces?.join("%2C") || "NB%2CNS%2CPE%2CNL";
  const page = params.page || 1;
  const encoded = encodeURIComponent(params.keywords);

  const url = `${BASE}/jobsearch/jobsearch?searchstring=${encoded}&sort=M&fprov=${provinces}&pg=${page}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html",
      },
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) return [];
    const html = await res.text();
    return parseListings(html);
  } catch {
    return [];
  }
}

export async function getJobPosting(jobId: string): Promise<string> {
  try {
    const res = await fetch(`${BASE}/jobsearch/jobposting/${jobId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Extract description block
    const descMatch = html.match(
      /id="tp-wgv-cont"[^>]*>([\s\S]*?)<\/section>/
    );
    if (descMatch) {
      return clean(descMatch[1]).slice(0, 3000);
    }
    // fallback
    const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    if (bodyMatch) return clean(bodyMatch[1]).slice(0, 3000);
    return "";
  } catch {
    return "";
  }
}

// ─── Enhanced: extract application details from a Job Bank posting ───

export interface JobApplyInfo {
  description: string;
  email: string | null;
  applyUrl: string | null;
  howToApply: string;
  contactName: string | null;
}

export async function getJobApplyInfo(jobId: string): Promise<JobApplyInfo> {
  const empty: JobApplyInfo = {
    description: "",
    email: null,
    applyUrl: null,
    howToApply: "",
    contactName: null,
  };

  try {
    const res = await fetch(`${BASE}/jobsearch/jobposting/${jobId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return empty;
    const html = await res.text();

    // Extract description
    const descMatch = html.match(/id="tp-wgv-cont"[^>]*>([\s\S]*?)<\/section>/);
    const description = descMatch ? clean(descMatch[1]).slice(0, 5000) : "";

    // Extract "How to apply" section
    const howToMatch = html.match(/how[\s-]*to[\s-]*apply([\s\S]*?)(?:<\/section>|<section)/i);
    const howToApply = howToMatch ? clean(howToMatch[1]) : "";

    // Extract email addresses from the page
    const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    const fullText = howToApply || html;
    const emails = fullText.match(emailRegex) || [];
    // Filter out common non-application emails
    const applicationEmail = emails.find((e) =>
      !e.includes("jobbank") &&
      !e.includes("canada.ca") &&
      !e.includes("noreply") &&
      !e.includes("donotreply") &&
      !e.includes("no-reply")
    ) || null;

    // Extract apply URL (online application link)
    const applyUrlMatch = html.match(/href="([^"]*)"[^>]*>\s*(?:Apply|Postuler|Submit|Apply online)/i);
    const applyUrl = applyUrlMatch ? applyUrlMatch[1] : null;

    // Extract contact name
    const contactMatch = howToApply.match(/(?:contact|name|attention|attn)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    const contactName = contactMatch ? contactMatch[1].trim() : null;

    return {
      description,
      email: applicationEmail,
      applyUrl,
      howToApply,
      contactName,
    };
  } catch {
    return empty;
  }
}
