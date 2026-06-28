"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Search, Briefcase, ChevronRight, ExternalLink, Sparkles,
  Clock, CheckCircle2, XCircle, Star, MessageSquare, FileText,
  Plus, Loader2, Trophy, ArrowRight, MapPin, DollarSign,
  Calendar, Users, RefreshCw, BookOpen, ChevronDown, ChevronUp,
  SlidersHorizontal, ArrowUpDown, Shield, Upload, Puzzle,
  Mail, Send, Eye, AlertCircle, Copy, Zap,
  BarChart3, ShieldCheck, Globe,
  Target, TrendingUp, ListChecks, ToggleLeft, ToggleRight,
} from "lucide-react";
import { ExtensionTab } from "@/components/jobs/extension-tab";
// Unified job type from API (JSearch + Job Bank merged)
interface SearchJob {
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
  program?: string | null;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type AppStatus =
  | "SAVED" | "PREPARING" | "APPLIED" | "VIEWED"
  | "INTERVIEW" | "OFFER" | "REJECTED" | "WITHDRAWN";

interface Application {
  id: string;
  profileId: string;
  externalId?: string | null;
  jobTitle: string;
  company: string;
  location?: string | null;
  salary?: string | null;
  jobUrl?: string | null;
  isAip: boolean;
  status: AppStatus;
  appliedAt?: Date | string | null;
  respondedAt?: Date | string | null;
  generatedCoverLetter?: string | null;
  cvTips?: string | null;
  compatibilityScore?: number | null;
  notes?: string | null;
  appliedVia?: string | null;
  appliedToEmail?: string | null;
  coverLetterGeneratedAt?: Date | string | null;
  createdAt: Date | string;
}

interface AppLog {
  id: string;
  status: string;
  site: string;
  jobUrl?: string | null;
  errorMessage?: string | null;
  formData?: Record<string, unknown> | null;
  createdAt: Date | string;
}

interface Profile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  isPrimaryApplicant: boolean | null;
  prefs: {
    jobTitles: string[];
    provinces: string[];
    aipOnly: boolean;
    cvText?: string | null;
  } | null;
}

interface Props {
  profiles: Profile[];
  applications: Application[];
  householdId: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const STATUSES: { key: AppStatus; label: string; color: string; bg: string }[] = [
  { key: "SAVED",      label: "Salva",      color: "text-foreground-muted", bg: "bg-surface" },
  { key: "PREPARING",  label: "Preparando", color: "text-warning",          bg: "bg-warning/10" },
  { key: "APPLIED",    label: "Aplicado",   color: "text-primary",          bg: "bg-primary/10" },
  { key: "VIEWED",     label: "Visualizado",color: "text-accent",            bg: "bg-accent/10" },
  { key: "INTERVIEW",  label: "Entrevista", color: "text-success",          bg: "bg-success/10" },
  { key: "OFFER",      label: "Oferta! 🎉", color: "text-success",          bg: "bg-success/15" },
  { key: "REJECTED",   label: "Recusado",   color: "text-foreground-dim",   bg: "bg-surface" },
  { key: "WITHDRAWN",  label: "Desistiu",   color: "text-foreground-dim",   bg: "bg-surface" },
];

const PIPELINE: AppStatus[] = ["SAVED", "PREPARING", "APPLIED", "VIEWED", "INTERVIEW", "OFFER"];

// ─────────────────────────────────────────────
// Immigration scoring + helpers
// ─────────────────────────────────────────────
const AIP_KEYWORDS = [
  "new brunswick", "nova scotia", "prince edward island",
  "newfoundland", "labrador", "fredericton", "moncton",
  "saint john", "halifax", "dartmouth", "charlottetown",
  "st. john's", "corner brook", "nb", "ns", "pe", "nl",
];
const PNP_PROVINCES = [
  "ontario", "british columbia", "alberta", "manitoba",
  "saskatchewan", "quebec",
];

function computeImmigrationScore(job: SearchJob): { score: number; tags: string[] } {
  let score = 0;
  const tags: string[] = [];
  const loc = (job.location || "").toLowerCase();
  const desc = (job.description || "").toLowerCase();

  // AIP province = huge boost
  if (AIP_KEYWORDS.some((k) => loc.includes(k)) || job.program === "AIP") {
    score += 40;
    tags.push("AIP");
  }

  // Other PNP provinces
  if (PNP_PROVINCES.some((k) => loc.includes(k))) {
    score += 20;
    tags.push("PNP");
  }

  // Remote = flexible for any province
  if (job.isRemote) {
    score += 25;
    tags.push("Remote");
  }

  // LMIA / sponsorship hints in description
  if (desc.includes("lmia") || desc.includes("work permit") || desc.includes("sponsorship") || desc.includes("immigration")) {
    score += 20;
    tags.push("LMIA/Sponsor");
  }

  // Direct apply / salary = more serious posting
  if (job.salary) score += 10;
  if (job.url && !job.url.includes("redirect")) score += 5;

  return { score: Math.min(score, 100), tags };
}

function extractProvince(location: string): string {
  const loc = location.toLowerCase();
  const map: Record<string, string> = {
    "ontario": "Ontario", "toronto": "Ontario", "ottawa": "Ontario", "mississauga": "Ontario",
    "british columbia": "BC", "vancouver": "BC", "victoria": "BC",
    "alberta": "Alberta", "calgary": "Alberta", "edmonton": "Alberta",
    "quebec": "Quebec", "montreal": "Quebec",
    "manitoba": "Manitoba", "winnipeg": "Manitoba",
    "saskatchewan": "Saskatchewan", "regina": "Saskatchewan", "saskatoon": "Saskatchewan",
    "nova scotia": "Nova Scotia", "halifax": "Nova Scotia",
    "new brunswick": "New Brunswick", "moncton": "New Brunswick", "fredericton": "New Brunswick", "saint john": "New Brunswick",
    "prince edward island": "PEI", "charlottetown": "PEI",
    "newfoundland": "NL", "st. john's": "NL",
  };
  for (const [key, val] of Object.entries(map)) {
    if (loc.includes(key)) return val;
  }
  if (loc.includes("remote") || loc.includes("canada")) return "Remote/Canada";
  return "Outro";
}

// ─────────────────────────────────────────────
// Description formatter — turns raw text into
// structured sections, bullets, and paragraphs
// ─────────────────────────────────────────────
interface DescBlock {
  type: "heading" | "bullet" | "paragraph";
  text: string;
}

function parseDescription(raw: string): DescBlock[] {
  const blocks: DescBlock[] = [];
  // Normalize line breaks
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Split into lines
  const lines = text.split("\n");

  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    const joined = currentParagraph.join(" ").trim();
    if (joined) blocks.push({ type: "paragraph", text: joined });
    currentParagraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    // Detect bullet points: •, -, *, >, ●, ○, ■, ▪, –, —
    const bulletMatch = line.match(/^[•‣⁃●○■▪▸\-\*\>–—∙]\s*(.+)/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({ type: "bullet", text: bulletMatch[1].trim() });
      continue;
    }

    // Detect numbered list: "1.", "1)", "1 -", "(1)"
    const numberedMatch = line.match(/^(?:\(?\d{1,2}\)?[\.\)\-\:]\s*)(.+)/);
    if (numberedMatch) {
      flushParagraph();
      blocks.push({ type: "bullet", text: numberedMatch[1].trim() });
      continue;
    }

    // Detect section headings:
    // - Short lines (< 60 chars) that end with ":"
    // - ALL CAPS lines (> 3 chars)
    // - Common section keywords
    const isHeading =
      (line.length < 60 && line.endsWith(":")) ||
      (line.length > 3 && line.length < 80 && line === line.toUpperCase() && /[A-Z]/.test(line)) ||
      /^(about|overview|responsibilities|requirements|qualifications|skills|experience|education|benefits|perks|compensation|what you|who you|why|how to|your role|the role|the team|we offer|what we|must have|nice to have|preferred|minimum|key |core )/i.test(line);

    if (isHeading) {
      flushParagraph();
      // Remove trailing colon for cleanliness
      const heading = line.replace(/:$/, "").trim();
      blocks.push({ type: "heading", text: heading });
      continue;
    }

    // Regular text — accumulate into paragraph
    currentParagraph.push(line);
  }
  flushParagraph();

  return blocks;
}

function FormattedDescription({ text }: { text: string }) {
  const blocks = parseDescription(text);

  // Group consecutive bullets together
  const grouped: (DescBlock | { type: "bulletGroup"; items: string[] })[] = [];
  for (const block of blocks) {
    if (block.type === "bullet") {
      const last = grouped[grouped.length - 1];
      if (last && "items" in last) {
        last.items.push(block.text);
      } else {
        grouped.push({ type: "bulletGroup", items: [block.text] });
      }
    } else {
      grouped.push(block);
    }
  }

  return (
    <div className="space-y-2.5">
      {grouped.map((block, i) => {
        if ("items" in block) {
          return (
            <ul key={i} className="space-y-1 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-xs text-foreground-muted leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "heading") {
          return (
            <h4 key={i} className="text-xs font-bold text-foreground pt-1 border-b border-border/30 pb-1">
              {block.text}
            </h4>
          );
        }
        // paragraph
        return (
          <p key={i} className="text-xs text-foreground-muted leading-relaxed">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Job-fit scoring — keyword overlap between
// user's profile titles and the job title/desc
// ─────────────────────────────────────────────
function computeJobFitScore(job: SearchJob, profile: Profile | undefined): number {
  if (!profile?.prefs?.jobTitles?.length) return 0;
  const titleWords = profile.prefs.jobTitles
    .flatMap(t => t.toLowerCase().split(/\s+/))
    .filter(w => w.length > 2);
  if (!titleWords.length) return 0;

  const jobText = `${job.title} ${job.description || ""}`.toLowerCase();
  let hits = 0;
  for (const w of titleWords) {
    if (jobText.includes(w)) hits++;
  }
  const ratio = hits / titleWords.length;
  return Math.min(Math.round(ratio * 100), 100);
}

// Immigration journey steps — computed from current data
const JOURNEY_STEPS = [
  { key: "profile", label: "Perfil", icon: "👤" },
  { key: "cv", label: "Currículo", icon: "📄" },
  { key: "searching", label: "Buscando", icon: "🔍" },
  { key: "applied", label: "Aplicado", icon: "📨" },
  { key: "interview", label: "Entrevista", icon: "💬" },
  { key: "offer", label: "Oferta", icon: "🎉" },
  { key: "lmia", label: "LMIA", icon: "📋" },
  { key: "pr", label: "PR", icon: "🍁" },
] as const;

function computeJourneyStep(apps: Application[], hasCv: boolean): number {
  if (apps.some(a => a.status === "OFFER")) return 5;
  if (apps.some(a => a.status === "INTERVIEW")) return 4;
  if (apps.some(a => ["APPLIED", "VIEWED"].includes(a.status))) return 3;
  if (apps.length > 0) return 2;
  if (hasCv) return 1;
  return 0;
}

function initials(p: Profile) {
  return `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase();
}
function fullName(p: Profile) {
  return `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
function statusMeta(s: AppStatus) {
  return STATUSES.find((x) => x.key === s) || STATUSES[0];
}
function daysAgo(d: Date | string | null | undefined) {
  if (!d) return null;
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days}d`;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export function JobsClient({ profiles, applications: initApps }: Props) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [view, setView] = useState<"dashboard" | "search" | "cv" | "extension">("dashboard");
  const [apps, setApps] = useState<Application[]>(initApps);

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchProfile, setSearchProfile] = useState(profiles[0]?.id || "");

  // Filter, sort & expand state
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "default">("default");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [loadingDescription, setLoadingDescription] = useState(false);

  // Detail panel (pipeline)
  const [selected, setSelected] = useState<Application | null>(null);
  const [generating, setGenerating] = useState(false);

  // One-click apply state
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<Record<string, { status: string; method: string; message: string }>>({});

  // Auto-apply batch state
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [autoApplying, setAutoApplying] = useState(false);
  const [autoApplyResults, setAutoApplyResults] = useState<{
    results: { jobId: string; jobTitle: string; company: string; status: string; method: string; message: string }[];
    summary: { total: number; applied: number; saved: number; failed: number };
  } | null>(null);

  // Review queue state (AI Apply pattern — review before batch apply)
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [visaDisclosure, setVisaDisclosure] = useState(true);

  // Application detail state
  const [appLogs, setAppLogs] = useState<AppLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [detailApplying, setDetailApplying] = useState(false);
  const [copiedCover, setCopiedCover] = useState(false);

  // CV tab state
  const [cvTexts, setCvTexts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => { map[p.id] = p.prefs?.cvText || ""; });
    return map;
  });
  const [cvUploading, setCvUploading] = useState<string | null>(null);
  const [cvSaving, setCvSaving] = useState<string | null>(null);
  const [cvSaved, setCvSaved] = useState<string | null>(null);

  const primaryProfile = profiles.find((p) => p.isPrimaryApplicant) || profiles[0];
  const spouseProfile = profiles.find((p) => !p.isPrimaryApplicant);

  // Filter apps by active tab
  const filteredApps = apps.filter((a) =>
    activeTab === "all" ? true : a.profileId === activeTab
  );

  // Stats per profile
  function statsFor(profileId?: string) {
    const subset = profileId ? apps.filter((a) => a.profileId === profileId) : apps;
    return {
      total: subset.length,
      applied: subset.filter((a) => ["APPLIED", "VIEWED", "INTERVIEW", "OFFER"].includes(a.status)).length,
      interviews: subset.filter((a) => ["INTERVIEW", "OFFER"].includes(a.status)).length,
      offers: subset.filter((a) => a.status === "OFFER").length,
    };
  }

  // Search Job Bank
  const handleSearch = useCallback(async (loadMore = false) => {
    if (!query.trim()) return;
    const page = loadMore ? searchPage + 1 : 1;
    if (loadMore) setLoadingMore(true); else setSearching(true);
    try {
      const r = await fetch(`/api/jobs/search?q=${encodeURIComponent(query)}&location=Canada&page=${page}`);
      const data = await r.json();
      if (!loadMore) {
        setLocationFilter("all");
        setSortBy("default");
        setExpandedJob(null);
      }
      if (loadMore) {
        setSearchResults((prev) => {
          const ids = new Set(prev.map((j) => j.id));
          return [...prev, ...data.filter((j: SearchJob) => !ids.has(j.id))];
        });
      } else {
        setSearchResults(data);
      }
      setSearchPage(page);
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  }, [query, searchPage]);

  // Save job to pipeline
  async function saveJob(job: SearchJob) {
    const r = await fetch("/api/jobs/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: searchProfile,
        externalId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        jobUrl: job.url,
        isAip: false,
        status: "SAVED",
      }),
    });
    const newApp = await r.json();
    setApps((prev) => [newApp, ...prev]);
    setView("dashboard");
  }

  // Update status
  async function updateStatus(appId: string, status: AppStatus) {
    await fetch(`/api/jobs/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    if (selected?.id === appId) setSelected((s) => s ? { ...s, status } : s);
  }

  // Generate AI content
  async function generateAI(appId: string, type: "cover_letter" | "cv_tips" | "both" = "both") {
    setGenerating(true);
    try {
      const r = await fetch("/api/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, type }),
      });
      const data = await r.json();
      setApps((prev) =>
        prev.map((a) =>
          a.id === appId
            ? { ...a, generatedCoverLetter: data.coverLetter ?? a.generatedCoverLetter, cvTips: data.cvTips ?? a.cvTips, compatibilityScore: data.compatibilityScore ?? a.compatibilityScore }
            : a
        )
      );
      if (selected?.id === appId) {
        setSelected((s) => s ? { ...s, generatedCoverLetter: data.coverLetter ?? s.generatedCoverLetter, cvTips: data.cvTips ?? s.cvTips, compatibilityScore: data.compatibilityScore ?? s.compatibilityScore } : s);
      }
    } finally {
      setGenerating(false);
    }
  }

  // Expand job — fetch description for Job Bank jobs on demand
  async function toggleExpand(jobId: string, job: SearchJob) {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    // Lazy-load description for Job Bank jobs that have none
    if (!job.description && jobId.startsWith("jb-")) {
      setLoadingDescription(true);
      try {
        const numericId = jobId.replace("jb-", "");
        const r = await fetch(`/api/jobs/detail?id=${numericId}`);
        const data = await r.json();
        if (data.description) {
          setSearchResults((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, description: data.description } : j))
          );
        }
      } finally {
        setLoadingDescription(false);
      }
    }
  }

  // Delete
  async function deleteApp(appId: string) {
    await fetch(`/api/jobs/applications/${appId}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== appId));
    if (selected?.id === appId) setSelected(null);
  }

  // ─── Load activity logs for an application ───
  async function loadAppLogs(appId: string) {
    setLoadingLogs(true);
    try {
      const r = await fetch(`/api/extension/report?applicationId=${appId}`);
      if (r.ok) {
        const data = await r.json();
        setAppLogs(data.logs || []);
      } else {
        setAppLogs([]);
      }
    } catch {
      setAppLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  // Select an application and load its logs
  function selectApp(app: Application) {
    setSelected(app);
    setCopiedCover(false);
    loadAppLogs(app.id);
  }

  // Apply directly from the detail panel (email or manual)
  async function applyFromDetail(app: Application) {
    setDetailApplying(true);
    try {
      const r = await fetch("/api/jobs/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs: [{
            id: app.externalId || app.id,
            title: app.jobTitle,
            company: app.company,
            location: app.location,
            salary: app.salary,
            url: app.jobUrl,
            description: "",
          }],
          profileId: app.profileId,
        }),
      });
      const data = await r.json();
      const result = data.results?.[0];

      if (result) {
        // Refresh applications to get updated data
        const appsR = await fetch("/api/jobs/applications");
        const freshApps = await appsR.json();
        setApps(freshApps);

        // Update selected with fresh data
        const updated = freshApps.find((a: Application) => a.id === app.id);
        if (updated) {
          setSelected(updated);
          loadAppLogs(updated.id);
        }
      }
    } catch (e) {
      console.error("[APPLY-FROM-DETAIL] Error:", e);
    } finally {
      setDetailApplying(false);
    }
  }

  // ─── (flow drawer removed — all apply is now one-click) ───

  // ─── CV Tab Functions ───
  async function saveCv(profileId: string) {
    setCvSaving(profileId);
    setCvSaved(null);
    try {
      await fetch("/api/jobs/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, cvText: cvTexts[profileId] || "" }),
      });
      setCvSaved(profileId);
      setTimeout(() => setCvSaved(null), 2000);
    } finally {
      setCvSaving(null);
    }
  }

  async function uploadCvForProfile(profileId: string, file: File) {
    setCvUploading(profileId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/jobs/cv-upload", { method: "POST", body: formData });
      const data = await r.json();
      if (data.error) { alert(data.error); return; }
      setCvTexts((prev) => ({ ...prev, [profileId]: data.text }));
    } finally {
      setCvUploading(null);
    }
  }

  // ─── Quick Apply (1-click) — auto-apply with inline feedback ───
  async function quickApply(job: SearchJob) {
    // Check if CV is configured
    const profilePrefs = profiles.find(p => p.id === searchProfile)?.prefs;
    if (!profilePrefs?.cvText) {
      setView("cv");
      return;
    }

    setApplyingJobId(job.id);
    try {
      const r = await fetch("/api/jobs/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs: [{
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            url: job.url,
            description: job.description,
            source: job.source,
            program: job.program,
          }],
          profileId: searchProfile,
        }),
      });
      const data = await r.json();
      const result = data.results?.[0];

      // Refresh applications
      const appsR = await fetch("/api/jobs/applications");
      setApps(await appsR.json());

      // Show inline result on the card
      if (result) {
        setApplyResult(prev => ({
          ...prev,
          [job.id]: { status: result.status, method: result.method, message: result.message },
        }));
        // Auto-clear after 10s
        setTimeout(() => {
          setApplyResult(prev => { const n = { ...prev }; delete n[job.id]; return n; });
        }, 10000);
      }
    } catch {
      setApplyResult(prev => ({
        ...prev,
        [job.id]: { status: "failed", method: "manual", message: "Erro ao aplicar. Tente novamente." },
      }));
    } finally {
      setApplyingJobId(null);
    }
  }

  // ─── Auto-Apply Batch ───
  function toggleJobSelection(jobId: string) {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function selectAllJobs() {
    if (selectedJobs.size === displayResults.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(displayResults.map((j) => j.id)));
    }
  }

  async function batchAutoApply() {
    if (selectedJobs.size === 0) return;
    // Check CV
    const profilePrefs = profiles.find(p => p.id === searchProfile)?.prefs;
    if (!profilePrefs?.cvText) {
      setView("cv");
      return;
    }
    setAutoApplying(true);
    setAutoApplyResults(null);
    try {
      const jobsToApply = searchResults
        .filter((j) => selectedJobs.has(j.id))
        .map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          salary: j.salary,
          url: j.url,
          description: j.description,
          source: j.source,
          program: j.program,
        }));

      const r = await fetch("/api/jobs/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: jobsToApply, profileId: searchProfile }),
      });
      const data = await r.json();
      setAutoApplyResults(data);

      // Store per-card inline results
      const newResults: Record<string, { status: string; method: string; message: string }> = {};
      for (const result of data.results || []) {
        newResults[result.jobId] = { status: result.status, method: result.method, message: result.message };
      }
      setApplyResult(prev => ({ ...prev, ...newResults }));

      // Auto-clear after 15s
      setTimeout(() => {
        setApplyResult(prev => {
          const n = { ...prev };
          for (const id of Object.keys(newResults)) delete n[id];
          return n;
        });
      }, 15000);

      // Refresh applications
      const appsR = await fetch("/api/jobs/applications");
      setApps(await appsR.json());

      // Clear selection
      setSelectedJobs(new Set());
    } catch (e) {
      console.error("[AUTO-APPLY] Error:", e);
    } finally {
      setAutoApplying(false);
    }
  }

  // Computed: unique provinces from current search results
  const resultProvinces = useMemo(() => {
    if (!searchResults.length) return [];
    const counts: Record<string, number> = {};
    searchResults.forEach((j) => {
      const prov = extractProvince(j.location);
      counts[prov] = (counts[prov] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [searchResults]);

  // Computed: filtered + sorted results
  const displayResults = useMemo(() => {
    let list = [...searchResults];
    // Apply location filter
    if (locationFilter !== "all") {
      list = list.filter((j) => extractProvince(j.location) === locationFilter);
    }
    // Apply sort — combined score (job fit + immigration)
    if (sortBy === "relevance") {
      list.sort((a, b) => {
        const scoreA = computeJobFitScore(a, activeProfile) + computeImmigrationScore(a).score;
        const scoreB = computeJobFitScore(b, activeProfile) + computeImmigrationScore(b).score;
        return scoreB - scoreA;
      });
    } else if (sortBy === "date") {
      // API returns newest first by default — no re-sort needed
    }
    return list;
  }, [searchResults, locationFilter, sortBy]);

  const allStats = statsFor();
  const primaryStats = statsFor(primaryProfile?.id);
  const spouseStats = spouseProfile ? statsFor(spouseProfile.id) : null;

  // Immigration journey progress
  const hasCv = !!profiles.find(p => p.isPrimaryApplicant)?.prefs?.cvText;
  const journeyStep = computeJourneyStep(apps, hasCv);
  const journeyPercent = Math.round((journeyStep / (JOURNEY_STEPS.length - 1)) * 100);

  // Current search profile for job-fit scoring
  const activeProfile = profiles.find(p => p.id === searchProfile);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vagas & Imigração</h1>
          <p className="text-sm text-foreground-muted">
            Descubra, aplique com IA e acompanhe seu caminho até o PR
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setView("dashboard")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${view === "dashboard" ? "bg-primary text-white" : "bg-white border border-border/60 text-foreground-muted hover:border-primary/40"}`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setView("search")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${view === "search" ? "bg-primary text-white" : "bg-white border border-border/60 text-foreground-muted hover:border-primary/40"}`}
          >
            <Search className="h-3.5 w-3.5" />
            Buscar Vagas
          </button>
          <button
            onClick={() => setView("cv")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${view === "cv" ? "bg-primary text-white" : "bg-white border border-border/60 text-foreground-muted hover:border-primary/40"}`}
          >
            <FileText className="h-3.5 w-3.5" />
            Currículo
          </button>
          <button
            onClick={() => setView("extension")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${view === "extension" ? "bg-primary text-white" : "bg-white border border-border/60 text-foreground-muted hover:border-primary/40"}`}
          >
            <Puzzle className="h-3.5 w-3.5" />
            Extensão
          </button>
        </div>
      </div>

      {/* ─── SEARCH VIEW ─── */}
      {view === "search" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-dim" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(false)}
                  placeholder="Ex: Product Designer, UX Designer..."
                  className="w-full rounded-xl border border-border/60 bg-surface/40 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <button
                onClick={() => handleSearch(false)}
                disabled={searching}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-primary/90"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </button>
            </div>
            {/* Profile selector */}
            <div className="flex items-center gap-2 text-xs text-foreground-muted">
              <span>Salvar como:</span>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSearchProfile(p.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${searchProfile === p.id ? "bg-primary text-white" : "bg-surface text-foreground-muted hover:bg-primary/10"}`}
                >
                  <span className="h-5 w-5 rounded-full bg-white/20 text-center text-[10px] leading-5">{initials(p)}</span>
                  {p.firstName}
                </button>
              ))}
              <span className="ml-1 text-foreground-dim">— Todo o Canada (vagas AIP sinalizadas)</span>
            </div>
          </div>

          {/* Results */}
          {searching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-foreground-muted">Buscando em LinkedIn, Indeed, Glassdoor, Job Bank...</span>
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="space-y-3">
              {/* ── Filter & Sort bar ── */}
              <div className="rounded-2xl border border-border/60 bg-white p-3 shadow-sm space-y-2.5">
                {/* Location chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-foreground-dim" />
                  <button
                    onClick={() => setLocationFilter("all")}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      locationFilter === "all"
                        ? "bg-primary text-white"
                        : "bg-surface text-foreground-muted hover:bg-primary/10"
                    }`}
                  >
                    Todas ({searchResults.length})
                  </button>
                  {resultProvinces.map(({ name, count }) => (
                    <button
                      key={name}
                      onClick={() => setLocationFilter(name === locationFilter ? "all" : name)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        locationFilter === name
                          ? "bg-primary text-white"
                          : "bg-surface text-foreground-muted hover:bg-primary/10"
                      }`}
                    >
                      {name} ({count})
                    </button>
                  ))}
                </div>
                {/* Sort */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-foreground-dim">
                    {displayResults.length} vaga{displayResults.length !== 1 ? "s" : ""}{locationFilter !== "all" ? ` em ${locationFilter}` : ""}
                  </p>
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3 text-foreground-dim" />
                    {(["default", "relevance", "date"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all ${
                          sortBy === s
                            ? "bg-primary/10 text-primary"
                            : "text-foreground-dim hover:text-foreground-muted"
                        }`}
                      >
                        {s === "default" ? "Padrão" : s === "relevance" ? "Match Score" : "Data"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Auto-Apply Bar with Review Queue ── */}
              {selectedJobs.size > 0 && (
                <div className="sticky top-0 z-30 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 shadow-lg backdrop-blur-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                      {selectedJobs.size}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {selectedJobs.size} vaga{selectedJobs.size !== 1 ? "s" : ""} selecionada{selectedJobs.size !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[10px] text-foreground-muted">
                        Revise antes de aplicar — a IA gera cover letter personalizada para cada vaga
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedJobs(new Set())}
                      className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:bg-surface"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={() => setShowReviewQueue(true)}
                      className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                    >
                      <Eye className="h-4 w-4" />
                      Revisar & Aplicar ({selectedJobs.size})
                    </button>
                  </div>
                </div>
              )}

              {/* ── Review Queue Modal ── */}
              {showReviewQueue && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                  <div className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-border/60 bg-white shadow-2xl overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="border-b border-border/40 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <ListChecks className="h-5 w-5 text-primary" />
                            Revisar Candidaturas
                          </h3>
                          <p className="text-xs text-foreground-muted mt-0.5">
                            Confirme as vagas antes da IA aplicar — nunca aplique às cegas
                          </p>
                        </div>
                        <button onClick={() => setShowReviewQueue(false)} className="text-foreground-dim hover:text-foreground">
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Job list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {searchResults.filter(j => selectedJobs.has(j.id)).map((job) => {
                        const immig = computeImmigrationScore(job);
                        const jobFit = computeJobFitScore(job, activeProfile);
                        return (
                          <div key={job.id} className="rounded-xl border border-border/40 p-3 flex items-center gap-3">
                            <button
                              onClick={() => toggleJobSelection(job.id)}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-primary bg-primary text-white"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{job.title}</p>
                              <p className="text-xs text-foreground-muted">{job.company} · {job.location}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-center">
                                <p className={`text-xs font-bold ${jobFit >= 60 ? "text-primary" : jobFit >= 30 ? "text-warning" : "text-foreground-dim"}`}>{jobFit}%</p>
                                <p className="text-[8px] text-foreground-dim">Job Fit</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-xs font-bold ${immig.score >= 60 ? "text-success" : immig.score >= 30 ? "text-warning" : "text-foreground-dim"}`}>{immig.score}%</p>
                                <p className="text-[8px] text-foreground-dim">Imigração</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Settings + Apply */}
                    <div className="border-t border-border/40 p-4 space-y-3">
                      {/* Visa disclosure toggle */}
                      <div className="flex items-center justify-between rounded-xl bg-surface/60 p-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-xs font-bold text-foreground">Divulgar status de visto na cover letter</p>
                            <p className="text-[10px] text-foreground-muted">Adiciona parágrafo profissional sobre autorização de trabalho</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setVisaDisclosure(!visaDisclosure)}
                          className={`flex items-center rounded-full transition-all ${visaDisclosure ? "text-primary" : "text-foreground-dim"}`}
                        >
                          {visaDisclosure ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowReviewQueue(false)}
                          className="flex-1 rounded-xl border border-border/60 py-2.5 text-sm font-semibold text-foreground-muted hover:bg-surface"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => { setShowReviewQueue(false); batchAutoApply(); }}
                          disabled={autoApplying}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60"
                        >
                          {autoApplying ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Aplicando...</>
                          ) : (
                            <><Sparkles className="h-4 w-4" /> Confirmar & Auto-Apply ({selectedJobs.size})</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Auto-Apply Results Modal ── */}
              {autoApplyResults && (
                <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <h3 className="font-bold text-foreground">Auto-Apply concluído!</h3>
                    </div>
                    <button
                      onClick={() => setAutoApplyResults(null)}
                      className="text-foreground-dim hover:text-foreground"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Summary */}
                  <div className="flex gap-3">
                    {autoApplyResults.summary.applied > 0 && (
                      <div className="rounded-xl bg-success/10 px-3 py-2 text-center flex-1">
                        <p className="text-lg font-bold text-success">{autoApplyResults.summary.applied}</p>
                        <p className="text-[10px] text-success">Aplicadas via email</p>
                      </div>
                    )}
                    {autoApplyResults.summary.saved > 0 && (
                      <div className="rounded-xl bg-warning/10 px-3 py-2 text-center flex-1">
                        <p className="text-lg font-bold text-warning">{autoApplyResults.summary.saved}</p>
                        <p className="text-[10px] text-warning">Cover letter pronta</p>
                      </div>
                    )}
                    {autoApplyResults.summary.failed > 0 && (
                      <div className="rounded-xl bg-red-50 px-3 py-2 text-center flex-1">
                        <p className="text-lg font-bold text-red-500">{autoApplyResults.summary.failed}</p>
                        <p className="text-[10px] text-red-500">Erros</p>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {autoApplyResults.results.map((r, i) => (
                      <div key={i} className={`rounded-lg p-2.5 ${r.status === "applied" ? "bg-success/5 border border-success/15" : r.status === "saved" ? "bg-warning/5 border border-warning/15" : "bg-red-50 border border-red-100"}`}>
                        <div className="flex items-center gap-2 text-xs">
                          {r.status === "applied" ? (
                            <Mail className="h-3.5 w-3.5 shrink-0 text-success" />
                          ) : r.status === "saved" ? (
                            <FileText className="h-3.5 w-3.5 shrink-0 text-warning" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                          )}
                          <span className="font-semibold text-foreground truncate">{r.jobTitle}</span>
                          <span className="text-foreground-dim">·</span>
                          <span className="text-foreground-muted truncate">{r.company}</span>
                        </div>
                        <p className="mt-1 ml-5.5 text-[10px] text-foreground-dim">{r.message}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setAutoApplyResults(null); setView("dashboard"); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    Ver no Pipeline →
                  </button>
                </div>
              )}

              {/* ── Results list ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-foreground-dim">LinkedIn • Indeed • Glassdoor • Job Bank • +</p>
                  <button
                    onClick={selectAllJobs}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    {selectedJobs.size === displayResults.length ? "Desmarcar todas" : "Selecionar todas"}
                  </button>
                </div>
                {displayResults.map((job) => {
                  const immig = computeImmigrationScore(job);
                  const jobFit = computeJobFitScore(job, activeProfile);
                  const isExpanded = expandedJob === job.id;
                  const combinedScore = Math.round((jobFit + immig.score) / 2);
                  const combinedColor =
                    combinedScore >= 50 ? "text-success bg-success/10 border-success/20"
                    : combinedScore >= 25 ? "text-warning bg-warning/10 border-warning/20"
                    : "text-foreground-dim bg-surface border-border/40";

                  return (
                    <div
                      key={job.id}
                      className={`rounded-2xl border bg-white shadow-sm transition-all ${
                        isExpanded ? "border-primary/30 ring-1 ring-primary/10" : "border-border/60 hover:border-primary/30"
                      }`}
                    >
                      {/* Card header */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Selection checkbox */}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleJobSelection(job.id); }}
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                                  selectedJobs.has(job.id)
                                    ? "border-primary bg-primary text-white"
                                    : "border-border/60 hover:border-primary/40"
                                }`}
                              >
                                {selectedJobs.has(job.id) && (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                              </button>
                              {/* Dual score badge */}
                              <div className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 ${combinedColor}`}>
                                <Target className="h-3 w-3" />
                                <span className="text-[11px] font-bold">{combinedScore}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h3 className="font-bold text-foreground">{job.title}</h3>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    job.source.includes("LinkedIn") ? "bg-blue-100 text-blue-700"
                                    : job.source.includes("Indeed") ? "bg-purple-100 text-purple-700"
                                    : job.source.includes("Glassdoor") ? "bg-green-100 text-green-700"
                                    : job.source.includes("Job Bank") ? "bg-primary/10 text-primary"
                                    : "bg-surface text-foreground-muted"
                                  }`}>
                                    via {job.source}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-sm font-medium text-foreground-muted">{job.company}</p>
                              </div>
                            </div>

                            {/* Dual score breakdown + immigration tags */}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {/* Score pills */}
                              <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${jobFit >= 50 ? "bg-primary/10 text-primary" : "bg-surface text-foreground-dim"}`}>
                                <Briefcase className="h-2.5 w-2.5" />
                                Job Fit {jobFit}%
                              </span>
                              <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${immig.score >= 50 ? "bg-success/10 text-success" : "bg-surface text-foreground-dim"}`}>
                                <Globe className="h-2.5 w-2.5" />
                                Imigração {immig.score}%
                              </span>
                              {immig.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    tag === "AIP" ? "bg-success/10 text-success"
                                    : tag === "PNP" ? "bg-accent/10 text-accent"
                                    : tag === "Remote" ? "bg-blue-50 text-blue-600"
                                    : tag === "LMIA/Sponsor" ? "bg-warning/10 text-warning"
                                    : "bg-surface text-foreground-muted"
                                  }`}
                                >
                                  <Shield className="h-2.5 w-2.5" />
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-foreground-dim">
                              {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
                              {job.salary && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary.slice(0, 40)}</span>}
                              {job.date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{job.date}</span>}
                              {job.employmentType && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{job.employmentType}</span>}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 flex-col gap-1.5 w-full sm:w-auto">
                            {/* Inline apply result */}
                            {applyResult[job.id] ? (
                              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                                applyResult[job.id].status === "applied"
                                  ? "bg-success/10 text-success border border-success/20"
                                  : applyResult[job.id].status === "saved"
                                  ? "bg-warning/10 text-warning border border-warning/20"
                                  : "bg-red-50 text-red-500 border border-red-100"
                              }`}>
                                {applyResult[job.id].status === "applied" ? (
                                  <Mail className="h-3.5 w-3.5 shrink-0" />
                                ) : applyResult[job.id].status === "saved" ? (
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="truncate">{applyResult[job.id].message}</span>
                                {applyResult[job.id].status === "saved" && job.url && (
                                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 underline hover:no-underline">
                                    Abrir vaga
                                  </a>
                                )}
                              </div>
                            ) : (
                              <div className="flex gap-1.5 sm:flex-row">
                                <button
                                  onClick={() => toggleExpand(job.id, job)}
                                  className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-semibold text-foreground-muted hover:border-primary/40 hover:text-primary"
                                  title="Ver detalhes"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  onClick={() => saveJob(job)}
                                  className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-semibold text-foreground-muted hover:border-primary/40 hover:text-primary"
                                  title="Salvar para depois"
                                >
                                  <Star className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => quickApply(job)}
                                  disabled={applyingJobId === job.id}
                                  className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-60 shadow-sm"
                                >
                                  {applyingJobId === job.id ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando...</>
                                  ) : (
                                    <><Zap className="h-3.5 w-3.5" /> Aplicar</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable description */}
                      {isExpanded && (
                        <div className="border-t border-border/40 px-4 py-3 space-y-3">
                          {/* Dual score bars */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Job Fit score */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim flex items-center gap-1">
                                  <Briefcase className="h-2.5 w-2.5" /> Job Fit
                                </span>
                                <span className={`text-xs font-bold ${jobFit >= 60 ? "text-primary" : jobFit >= 30 ? "text-warning" : "text-foreground-dim"}`}>
                                  {jobFit}/100
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-surface">
                                <div className={`h-2 rounded-full transition-all ${jobFit >= 60 ? "bg-primary" : jobFit >= 30 ? "bg-warning" : "bg-foreground-dim/30"}`}
                                  style={{ width: `${jobFit}%` }} />
                              </div>
                            </div>
                            {/* Immigration score */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim flex items-center gap-1">
                                  <Globe className="h-2.5 w-2.5" /> Imigração
                                </span>
                                <span className={`text-xs font-bold ${immig.score >= 60 ? "text-success" : immig.score >= 30 ? "text-warning" : "text-foreground-dim"}`}>
                                  {immig.score}/100
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-surface">
                                <div className={`h-2 rounded-full transition-all ${immig.score >= 60 ? "bg-success" : immig.score >= 30 ? "bg-warning" : "bg-foreground-dim/30"}`}
                                  style={{ width: `${immig.score}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* Immigration insights */}
                          {immig.tags.length > 0 && (
                            <div className="rounded-xl bg-surface/50 p-2.5 space-y-1.5">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-foreground-dim">Insights de imigração</p>
                              <div className="flex flex-wrap gap-2 text-[11px]">
                                {immig.tags.includes("AIP") && (
                                  <span className="flex items-center gap-1 text-success">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Atlantic Immigration Program — facilita PR
                                  </span>
                                )}
                                {immig.tags.includes("PNP") && (
                                  <span className="flex items-center gap-1 text-accent">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Provincial Nominee Program disponível
                                  </span>
                                )}
                                {immig.tags.includes("Remote") && (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Remoto — flexível para qualquer província
                                  </span>
                                )}
                                {immig.tags.includes("LMIA/Sponsor") && (
                                  <span className="flex items-center gap-1 text-warning">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Menção a LMIA / work permit / sponsorship
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Job description */}
                          {loadingDescription && expandedJob === job.id ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="ml-2 text-xs text-foreground-muted">Carregando descrição...</span>
                            </div>
                          ) : job.description ? (
                            <div>
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">
                                Descrição da vaga
                              </p>
                              <div className="rounded-xl bg-surface/50 p-4 max-h-80 overflow-y-auto">
                                <FormattedDescription text={job.description} />
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl bg-surface/50 p-3 text-center">
                              <p className="text-xs text-foreground-dim">
                                Descrição não disponível — <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ver no site original</a>
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Load more button */}
              <button
                onClick={() => handleSearch(true)}
                disabled={loadingMore}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-white py-3 text-sm font-semibold text-foreground-muted hover:border-primary/40 hover:text-primary disabled:opacity-60"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loadingMore ? "Carregando..." : "Carregar mais vagas"}
              </button>
            </div>
          )}

          {!searching && searchResults.length === 0 && query && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-white py-12 text-center">
              <Search className="mx-auto mb-2 h-8 w-8 text-foreground-dim" />
              <p className="text-sm text-foreground-muted">Nenhuma vaga encontrada. Tente outros termos.</p>
            </div>
          )}

          {!searching && searchResults.length === 0 && !query && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-white py-12 text-center space-y-3">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Search className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Descubra vagas ideais para imigração</p>
                <p className="mt-1 text-xs text-foreground-muted max-w-md mx-auto">
                  A IA busca em LinkedIn, Indeed, Glassdoor e Job Bank — e classifica cada vaga por <strong>Job Fit</strong> e <strong>compatibilidade imigratória</strong> (AIP, PNP, LMIA)
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-[10px]">
                {["Product Designer", "UX Designer", "Early Childhood Educator", "Software Engineer"].map(term => (
                  <button key={term} onClick={() => { setQuery(term); }} className="rounded-full bg-surface px-3 py-1 font-semibold text-foreground-muted hover:bg-primary/10 hover:text-primary transition-all">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── CV TAB ─── */}
      {view === "cv" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Currículos</h2>
            <p className="text-xs text-foreground-muted">
              Gerencie os currículos de cada perfil. Eles serão usados automaticamente ao aplicar nas vagas.
            </p>
          </div>

          {profiles.map((profile) => {
            const pid = profile.id;
            const cvText = cvTexts[pid] || "";
            const wordCount = cvText.split(/\s+/).filter(Boolean).length;
            const isSaving = cvSaving === pid;
            const isSaved = cvSaved === pid;
            const isUploading = cvUploading === pid;

            return (
              <div key={pid} className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
                {/* Profile header */}
                <div className="flex items-center gap-3 border-b border-border/40 px-5 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    {initials(profile)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground">{fullName(profile)}</p>
                    <p className="text-xs text-foreground-muted">
                      {profile.prefs?.jobTitles?.[0] || (profile.isPrimaryApplicant ? "Product Designer" : "Early Childhood Educator")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSaved && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Salvo
                      </span>
                    )}
                    <span className="text-[10px] text-foreground-dim">{wordCount > 0 ? `${wordCount} palavras` : "Vazio"}</span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {/* Upload area */}
                  <div className="rounded-xl border-2 border-dashed border-border/60 bg-surface/20 p-3 text-center hover:border-primary/40 transition-colors relative">
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadCvForProfile(pid, f);
                        e.target.value = "";
                      }}
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs text-foreground-muted">Processando...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <Upload className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground-muted">Subir PDF, DOCX ou TXT</span>
                      </div>
                    )}
                  </div>

                  {/* CV textarea */}
                  <textarea
                    value={cvText}
                    onChange={(e) => setCvTexts((prev) => ({ ...prev, [pid]: e.target.value }))}
                    placeholder="Cole ou edite o currículo aqui..."
                    className="w-full rounded-xl border border-border/60 bg-surface/30 p-4 text-xs leading-relaxed text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 min-h-[200px] resize-y font-mono"
                  />

                  {/* Save button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => saveCv(pid)}
                      disabled={isSaving}
                      className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-primary/90"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Salvar Currículo
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-border/40 bg-surface/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim mb-1.5">Como funciona</p>
            <ul className="space-y-1">
              {[
                "Salve o currículo de cada perfil (Rafael e Luana)",
                "Ao clicar Aplicar em uma vaga, a IA usa o currículo salvo",
                "A cover letter é gerada personalizada para cada vaga",
                "Dicas de CV mostram o que ajustar para cada oportunidade",
              ].map((tip, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-foreground-muted">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ─── DASHBOARD VIEW ─── */}
      {view === "dashboard" && (
        <div className="space-y-5">
          {/* ── Immigration Journey Progress ── */}
          <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-primary/5 via-white to-success/5 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Jornada de Imigração
                </h2>
                <p className="text-[10px] text-foreground-muted mt-0.5">Seu progresso até a residência permanente</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{journeyPercent}%</span>
            </div>
            <div className="relative">
              {/* Progress bar */}
              <div className="absolute top-4 left-0 right-0 h-1 bg-border/30 rounded-full">
                <div className="h-1 rounded-full bg-gradient-to-r from-primary to-success transition-all duration-700" style={{ width: `${journeyPercent}%` }} />
              </div>
              {/* Steps */}
              <div className="relative flex justify-between">
                {JOURNEY_STEPS.map((step, i) => {
                  const isCompleted = i <= journeyStep;
                  const isCurrent = i === journeyStep;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-1.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all ${
                        isCurrent
                          ? "bg-primary text-white ring-4 ring-primary/20 scale-110"
                          : isCompleted
                          ? "bg-success/15 text-success"
                          : "bg-surface text-foreground-dim"
                      }`}>
                        {step.icon}
                      </div>
                      <span className={`text-[9px] font-semibold ${isCurrent ? "text-primary" : isCompleted ? "text-success" : "text-foreground-dim"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stats cards — dual: job + immigration */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Candidaturas", value: allStats.total, icon: Briefcase, color: "text-foreground-muted", sub: "total" },
              { label: "Aplicadas", value: allStats.applied, icon: Send, color: "text-primary", sub: "enviadas" },
              { label: "Entrevistas", value: allStats.interviews, icon: MessageSquare, color: "text-success", sub: "agendadas" },
              { label: "Ofertas", value: allStats.offers, icon: Trophy, color: "text-warning", sub: allStats.offers > 0 ? "LMIA pendente" : "aguardando" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  {s.label}
                </div>
                <p className={`mt-1.5 text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-foreground-dim mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Profile stat cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { profile: primaryProfile, stats: primaryStats },
              ...(spouseProfile ? [{ profile: spouseProfile, stats: spouseStats! }] : []),
            ].map(({ profile, stats }) => (
              <div key={profile.id} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                  {initials(profile)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{fullName(profile)}</p>
                  <p className="text-xs text-foreground-muted truncate">
                    {profile.prefs?.jobTitles?.[0] || (profile.isPrimaryApplicant ? "Product Designer" : "Early Childhood Educator")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {profile.prefs?.cvText ? (
                      <span className="flex items-center gap-0.5 text-[9px] font-semibold text-success"><CheckCircle2 className="h-2.5 w-2.5" /> CV pronto</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[9px] font-semibold text-warning"><AlertCircle className="h-2.5 w-2.5" /> CV pendente</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{stats.applied}</p>
                  <p className="text-[10px] text-foreground-dim">aplicadas</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button onClick={() => setView("search")} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm hover:border-primary/40 transition-all">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Search className="h-4 w-4 text-primary" /></div>
              <div className="text-left"><p className="text-xs font-bold text-foreground">Buscar Vagas</p><p className="text-[9px] text-foreground-dim">LinkedIn, Indeed, Job Bank</p></div>
            </button>
            <button onClick={() => setView("cv")} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm hover:border-primary/40 transition-all">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10"><FileText className="h-4 w-4 text-accent" /></div>
              <div className="text-left"><p className="text-xs font-bold text-foreground">Currículo</p><p className="text-[9px] text-foreground-dim">Upload e otimização</p></div>
            </button>
            <button onClick={() => setView("search")} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm hover:border-primary/40 transition-all">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10"><Zap className="h-4 w-4 text-success" /></div>
              <div className="text-left"><p className="text-xs font-bold text-foreground">Auto-Apply</p><p className="text-[9px] text-foreground-dim">IA aplica por você</p></div>
            </button>
            <button onClick={() => setView("extension")} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm hover:border-primary/40 transition-all">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10"><Puzzle className="h-4 w-4 text-warning" /></div>
              <div className="text-left"><p className="text-xs font-bold text-foreground">Extensão</p><p className="text-[9px] text-foreground-dim">Apply em qualquer site</p></div>
            </button>
          </div>

          {/* Pipeline content */}
          <div className="flex gap-4">
          {/* Pipeline + list */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Section heading */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                Candidaturas
              </h2>
              {/* Profile tabs */}
              <div className="flex items-center gap-1 rounded-xl bg-surface p-1">
                {[
                  { id: "all", label: "Todas", icon: Users },
                  { id: primaryProfile.id, label: primaryProfile.firstName || "Rafael", icon: null },
                  ...(spouseProfile ? [{ id: spouseProfile.id, label: spouseProfile.firstName || "Luana", icon: null }] : []),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${activeTab === tab.id ? "bg-white text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"}`}
                  >
                    {tab.icon ? <tab.icon className="h-3.5 w-3.5" /> : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                        {tab.label[0]}
                      </span>
                    )}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pipeline status bar */}
            <div className="hidden sm:flex items-center gap-1 overflow-x-auto pb-1">
              {PIPELINE.map((status, i) => {
                const meta = statusMeta(status);
                const count = filteredApps.filter((a) => a.status === status).length;
                return (
                  <div key={status} className="flex items-center gap-1">
                    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${meta.bg} ${meta.color}`}>
                      {meta.label}
                      {count > 0 && <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-bold">{count}</span>}
                    </div>
                    {i < PIPELINE.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-foreground-dim" />}
                  </div>
                );
              })}
            </div>

            {/* App list */}
            {filteredApps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-white py-10 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <TrendingUp className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Comece sua jornada</p>
                  <p className="text-xs text-foreground-muted mt-0.5">3 passos: currículo → buscar vagas → a IA aplica por você</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setView("cv")}
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold text-foreground-muted hover:border-primary/40"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    1. Currículo
                  </button>
                  <button
                    onClick={() => setView("search")}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Search className="h-3.5 w-3.5" />
                    2. Buscar Vagas
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredApps.map((app) => {
                  const meta = statusMeta(app.status);
                  const owner = profiles.find((p) => p.id === app.profileId);
                  return (
                    <button
                      key={app.id}
                      onClick={() => selectApp(app)}
                      className={`w-full text-left rounded-2xl border bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md ${selected?.id === app.id ? "border-primary/40 ring-2 ring-primary/10" : "border-border/60"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Profile badge */}
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                              {owner ? initials(owner) : "?"}
                            </span>
                            <h3 className="font-bold text-foreground truncate">{app.jobTitle}</h3>
                            {app.isAip && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">AIP ✓</span>}
                            {app.compatibilityScore && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{app.compatibilityScore}% match</span>
                            )}
                            {/* Application method indicator */}
                            {app.appliedVia === "email" && (
                              <span className="flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success">
                                <Mail className="h-2.5 w-2.5" /> Email
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-foreground-muted">{app.company}</p>
                          {app.location && <p className="flex items-center gap-1 text-xs text-foreground-dim mt-0.5"><MapPin className="h-3 w-3" />{app.location}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-foreground-dim">{daysAgo(app.createdAt)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel — clean & focused */}
          {selected && (
            <>
            {/* Mobile backdrop */}
            <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSelected(null)} />
            <div className="fixed inset-x-0 bottom-0 z-50 lg:relative lg:inset-auto lg:z-auto flex w-full lg:w-96 shrink-0 flex-col rounded-t-2xl lg:rounded-2xl border border-border/60 bg-white shadow-lg lg:shadow-sm overflow-hidden max-h-[85vh] lg:max-h-[calc(100vh-180px)]">
              {/* Header with status + score */}
              <div className="border-b border-border/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground line-clamp-2">{selected.jobTitle}</h3>
                    <p className="text-sm text-foreground-muted">{selected.company}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {selected.location && (
                        <span className="flex items-center gap-0.5 text-[10px] text-foreground-dim">
                          <MapPin className="h-2.5 w-2.5" />{selected.location}
                        </span>
                      )}
                      {selected.salary && (
                        <span className="flex items-center gap-0.5 text-[10px] text-foreground-dim">
                          <DollarSign className="h-2.5 w-2.5" />{selected.salary.slice(0, 30)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="shrink-0 text-foreground-dim hover:text-foreground">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
                {/* Status + method badges */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta(selected.status).bg} ${statusMeta(selected.status).color}`}>
                    {statusMeta(selected.status).label}
                  </span>
                  {selected.appliedVia === "email" && (
                    <span className="flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                      <Mail className="h-2.5 w-2.5" /> Email enviado
                    </span>
                  )}
                  {selected.compatibilityScore && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{selected.compatibilityScore}%</span>
                  )}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">

                {/* Apply button — for non-applied jobs (most important action) */}
                {!["APPLIED", "VIEWED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"].includes(selected.status) && (
                  <div className="border-b border-border/40 p-4">
                    <button
                      onClick={() => applyFromDetail(selected)}
                      disabled={detailApplying}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-white disabled:opacity-60 hover:bg-primary/90 transition-all shadow-sm"
                    >
                      {detailApplying ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Aplicando...</>
                      ) : (
                        <><Zap className="h-4 w-4" /> Aplicar Agora</>
                      )}
                    </button>
                    <p className="mt-1 text-center text-[10px] text-foreground-dim">
                      Gera cover letter + envia email automaticamente quando possivel
                    </p>
                  </div>
                )}

                {/* Application proof (only shown after applying) */}
                {selected.appliedVia === "email" && (
                  <div className="border-b border-border/40 p-3 mx-4 mt-3 rounded-xl bg-success/5 border-success/20">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-success shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-success">Email enviado com sucesso</p>
                        {selected.appliedToEmail && (
                          <p className="text-[10px] text-foreground-muted">Para: <span className="font-mono">{selected.appliedToEmail}</span></p>
                        )}
                        {selected.appliedAt && (
                          <p className="text-[10px] text-foreground-dim">{new Date(selected.appliedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="border-b border-border/40 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Historico</p>
                  <div className="space-y-0">
                    {/* Created */}
                    <div className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center"><Plus className="h-2.5 w-2.5 text-primary" /></div>
                        <div className="w-px flex-1 bg-border/30" />
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground">Adicionada</p>
                        <p className="text-[10px] text-foreground-dim">{new Date(selected.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    {/* Cover letter */}
                    {(selected.coverLetterGeneratedAt || selected.generatedCoverLetter) && (
                      <div className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          <div className="h-5 w-5 rounded-full bg-accent/15 flex items-center justify-center"><Sparkles className="h-2.5 w-2.5 text-accent" /></div>
                          <div className="w-px flex-1 bg-border/30" />
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground">Cover letter gerada</p>
                          <p className="text-[10px] text-foreground-dim">{selected.coverLetterGeneratedAt ? new Date(selected.coverLetterGeneratedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                        </div>
                      </div>
                    )}
                    {/* Applied */}
                    {selected.appliedAt && (
                      <div className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          <div className="h-5 w-5 rounded-full bg-success/15 flex items-center justify-center"><Send className="h-2.5 w-2.5 text-success" /></div>
                          <div className="w-px flex-1 bg-border/30" />
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground">{selected.appliedVia === "email" ? "Email enviado" : "Aplicado manualmente"}</p>
                          <p className="text-[10px] text-foreground-dim">{new Date(selected.appliedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                          {selected.appliedToEmail && <p className="text-[10px] text-foreground-muted">{selected.appliedToEmail}</p>}
                        </div>
                      </div>
                    )}
                    {/* Response */}
                    {selected.respondedAt && (
                      <div className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center"><MessageSquare className="h-2.5 w-2.5 text-primary" /></div>
                          <div className="w-px flex-1 bg-border/30" />
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground">Resposta recebida</p>
                          <p className="text-[10px] text-foreground-dim">{new Date(selected.respondedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    )}
                    {/* Logs */}
                    {!loadingLogs && appLogs.map((log) => (
                      <div key={log.id} className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center ${log.status === "SUCCESS" ? "bg-success/15" : log.status === "FAILED" ? "bg-red-500/15" : "bg-warning/15"}`}>
                            {log.status === "SUCCESS" ? <CheckCircle2 className="h-2.5 w-2.5 text-success" /> : log.status === "FAILED" ? <AlertCircle className="h-2.5 w-2.5 text-red-500" /> : <Clock className="h-2.5 w-2.5 text-warning" />}
                          </div>
                          <div className="w-px flex-1 bg-border/30" />
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground">{log.status === "SUCCESS" ? "Enviado" : log.status === "FAILED" ? "Falha" : "Parcial"}</p>
                          <p className="text-[10px] text-foreground-dim">{new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                          {log.errorMessage && <p className="text-[10px] text-red-500 line-clamp-1">{log.errorMessage}</p>}
                        </div>
                      </div>
                    ))}
                    {/* Current status */}
                    <div className="flex gap-2.5">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-current ${statusMeta(selected.status).bg} ${statusMeta(selected.status).color}`}>
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                      </div>
                      <p className={`text-[11px] font-bold ${statusMeta(selected.status).color}`}>{statusMeta(selected.status).label}</p>
                    </div>
                  </div>
                </div>

                {/* Cover letter */}
                {selected.generatedCoverLetter && (
                  <div className="border-b border-border/40 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Cover Letter</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateAI(selected.id, "cover_letter")}
                          disabled={generating}
                          className="flex items-center gap-0.5 text-[10px] text-foreground-dim hover:text-primary"
                        >
                          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selected.generatedCoverLetter!);
                            setCopiedCover(true);
                            setTimeout(() => setCopiedCover(false), 2000);
                          }}
                          className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                        >
                          {copiedCover ? <><CheckCircle2 className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                        </button>
                      </div>
                    </div>
                    {/* Visa disclosure toggle */}
                    <div className="flex items-center justify-between rounded-lg bg-surface/40 px-2.5 py-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-foreground-muted">
                        <ShieldCheck className="h-3 w-3" />
                        Incluir parágrafo de autorização de trabalho
                      </span>
                      <button
                        onClick={() => setVisaDisclosure(!visaDisclosure)}
                        className={visaDisclosure ? "text-primary" : "text-foreground-dim"}
                      >
                        {visaDisclosure ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                    </div>
                    <div className="rounded-xl bg-surface/60 p-3 text-xs text-foreground-muted whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {selected.generatedCoverLetter}
                    </div>
                  </div>
                )}

                {/* Status selector */}
                <div className="border-b border-border/40 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => updateStatus(selected.id, s.key)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${selected.status === s.key ? `${s.bg} ${s.color} ring-1 ring-current` : "bg-surface text-foreground-muted hover:bg-primary/5"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 flex items-center gap-2">
                  {selected.jobUrl && (
                    <a
                      href={selected.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 py-2 text-xs font-semibold text-foreground-muted hover:border-primary/40 hover:text-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver vaga
                    </a>
                  )}
                  <button
                    onClick={() => deleteApp(selected.id)}
                    className="rounded-xl border border-border/60 px-3 py-2 text-xs text-foreground-dim hover:text-red-500 hover:border-red-200"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* ─── EXTENSION VIEW ─── */}
      {view === "extension" && (
        <ExtensionTab profiles={profiles} />
      )}
    </div>
  );
}
