"use client";

import { useState, useCallback } from "react";
import {
  Search, Briefcase, ChevronRight, ExternalLink, Sparkles,
  Clock, CheckCircle2, XCircle, Star, MessageSquare, FileText,
  Plus, Loader2, Trophy, ArrowRight, MapPin, DollarSign,
  Calendar, Users, RefreshCw, BookOpen,
} from "lucide-react";
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
// Helpers
// ─────────────────────────────────────────────
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
  const [view, setView] = useState<"pipeline" | "search">("pipeline");
  const [apps, setApps] = useState<Application[]>(initApps);

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchProfile, setSearchProfile] = useState(profiles[0]?.id || "");

  // Detail panel
  const [selected, setSelected] = useState<Application | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genType, setGenType] = useState<"cover_letter" | "cv_tips" | "both">("both");

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
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/jobs/search?q=${encodeURIComponent(query)}&location=Canada`);
      const data = await r.json();
      setSearchResults(data);
    } finally {
      setSearching(false);
    }
  }, [query]);

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
    setView("pipeline");
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
  async function generateAI(appId: string, type: typeof genType) {
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

  // Delete
  async function deleteApp(appId: string) {
    await fetch(`/api/jobs/applications/${appId}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== appId));
    if (selected?.id === appId) setSelected(null);
  }

  const allStats = statsFor();
  const primaryStats = statsFor(primaryProfile?.id);
  const spouseStats = spouseProfile ? statsFor(spouseProfile.id) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vagas de Emprego</h1>
          <p className="text-sm text-foreground-muted">
            Busque, candidate-se e acompanhe — tudo em um lugar
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("pipeline")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${view === "pipeline" ? "bg-primary text-white" : "bg-white border border-border/60 text-foreground-muted hover:border-primary/40"}`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setView("search")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${view === "search" ? "bg-primary text-white" : "bg-white border border-border/60 text-foreground-muted hover:border-primary/40"}`}
          >
            <Search className="h-4 w-4" />
            Buscar Vagas
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: allStats.total, icon: Briefcase, color: "text-foreground-muted" },
          { label: "Aplicadas", value: allStats.applied, icon: CheckCircle2, color: "text-primary" },
          { label: "Entrevistas", value: allStats.interviews, icon: MessageSquare, color: "text-success" },
          { label: "Ofertas", value: allStats.offers, icon: Trophy, color: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              {s.label}
            </div>
            <p className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</p>
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
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{stats.applied}</p>
              <p className="text-[10px] text-foreground-dim">aplicadas</p>
            </div>
          </div>
        ))}
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
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Ex: Product Designer, UX Designer..."
                  className="w-full rounded-xl border border-border/60 bg-surface/40 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <button
                onClick={handleSearch}
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
              <span className="ml-2 text-sm text-foreground-muted">Buscando no Job Bank Canada...</span>
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground-muted">{searchResults.length} vagas encontradas</p>
              {searchResults.map((job) => (
                <div key={job.id} className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                        {job.program && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">{job.program} ✓</span>
                        )}
                        {job.isRemote && (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">Remote</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-foreground-muted">{job.company}</p>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-foreground-dim">
                        {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
                        {job.salary && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary.slice(0, 40)}</span>}
                        {job.date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{job.date}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:border-primary/40 hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ver
                      </a>
                      <button
                        onClick={() => saveJob(job)}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searchResults.length === 0 && query && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-white py-12 text-center">
              <Search className="mx-auto mb-2 h-8 w-8 text-foreground-dim" />
              <p className="text-sm text-foreground-muted">Nenhuma vaga encontrada. Tente outros termos.</p>
            </div>
          )}

          {!searching && searchResults.length === 0 && !query && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-white py-12 text-center">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-foreground-dim" />
              <p className="text-sm font-medium text-foreground-muted">Busque vagas no Job Bank Canada</p>
              <p className="mt-1 text-xs text-foreground-dim">LinkedIn, Indeed, Glassdoor, Job Bank e mais — todo o Canada</p>
            </div>
          )}
        </div>
      )}

      {/* ─── PIPELINE VIEW ─── */}
      {view === "pipeline" && (
        <div className="flex gap-4">
          {/* Pipeline + list */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Profile tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-surface p-1 w-fit">
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
              <div className="rounded-2xl border border-dashed border-border/60 bg-white py-12 text-center">
                <Briefcase className="mx-auto mb-2 h-8 w-8 text-foreground-dim" />
                <p className="text-sm font-medium text-foreground-muted">Nenhuma candidatura ainda</p>
                <button
                  onClick={() => setView("search")}
                  className="mt-3 flex items-center gap-1.5 mx-auto rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
                >
                  <Search className="h-3.5 w-3.5" />
                  Buscar vagas
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredApps.map((app) => {
                  const meta = statusMeta(app.status);
                  const owner = profiles.find((p) => p.id === app.profileId);
                  return (
                    <button
                      key={app.id}
                      onClick={() => setSelected(app)}
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

          {/* Detail panel */}
          {selected && (
            <div className="hidden lg:flex w-80 shrink-0 flex-col rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-border/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground line-clamp-2">{selected.jobTitle}</h3>
                    <p className="text-sm text-foreground-muted">{selected.company}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="shrink-0 text-foreground-dim hover:text-foreground">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
                {selected.salary && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-foreground-dim">
                    <DollarSign className="h-3 w-3" />{selected.salary.slice(0, 50)}
                  </p>
                )}
              </div>

              {/* Status selector */}
              <div className="border-b border-border/40 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Status</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUSES.slice(0, 6).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => updateStatus(selected.id, s.key)}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all ${selected.status === s.key ? `${s.bg} ${s.color} ring-1 ring-current` : "bg-surface text-foreground-muted hover:bg-primary/10"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI generate */}
              <div className="border-b border-border/40 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Gerar com IA</p>
                <div className="flex gap-1.5 mb-2">
                  {(["cover_letter", "cv_tips", "both"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setGenType(t)}
                      className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${genType === t ? "bg-primary text-white" : "bg-surface text-foreground-muted"}`}
                    >
                      {t === "cover_letter" ? "Cover" : t === "cv_tips" ? "CV" : "Ambos"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => generateAI(selected.id, genType)}
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-primary/90"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generating ? "Gerando..." : "Gerar"}
                </button>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.compatibilityScore && (
                  <div className="rounded-xl bg-primary/10 p-3">
                    <p className="text-xs font-bold text-primary">{selected.compatibilityScore}% compatibilidade</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/60">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${selected.compatibilityScore}%` }} />
                    </div>
                  </div>
                )}

                {selected.cvTips && (
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Dicas para CV</p>
                    <div className="rounded-xl bg-surface/60 p-3 text-xs text-foreground-muted whitespace-pre-wrap leading-relaxed">
                      {selected.cvTips}
                    </div>
                  </div>
                )}

                {selected.generatedCoverLetter && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Cover Letter</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(selected.generatedCoverLetter!)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Copiar
                      </button>
                    </div>
                    <div className="rounded-xl bg-surface/60 p-3 text-xs text-foreground-muted whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {selected.generatedCoverLetter}
                    </div>
                  </div>
                )}

                {selected.jobUrl && (
                  <a
                    href={selected.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-border/60 py-2 text-xs font-semibold text-foreground-muted hover:border-primary/40 hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir vaga
                  </a>
                )}

                <button
                  onClick={() => deleteApp(selected.id)}
                  className="flex w-full items-center justify-center gap-1 py-1.5 text-[11px] text-foreground-dim hover:text-primary"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Remover
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
