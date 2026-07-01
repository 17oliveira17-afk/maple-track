"use client";

import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Search,
  Languages,
  GraduationCap,
  Send,
  PartyPopper,
  Stamp,
  Plane,
  Home,
  Flag,
  Check,
  ChevronRight,
  FileText,
  Users,
  Trophy,
  Bell,
  AlertTriangle,
  Zap,
  Briefcase,
  CheckCircle2,
  MapPin,
  Circle,
} from "lucide-react";
import {
  ResearchStageIllustration,
  LanguageStageIllustration,
  EcaStageIllustration,
  SubmissionStageIllustration,
  ApprovalStageIllustration,
  VisaStageIllustration,
  LandingStageIllustration,
  PrStageIllustration,
  CitizenshipStageIllustration,
} from "@/components/illustrations/stages";
import type { MacroMilestoneWithStatus, MacroMilestoneId } from "@/lib/macro-journey";
import { getCurrentMilestoneIndex } from "@/lib/macro-journey";

interface DashboardClientProps {
  userName: string;
  userImage?: string;
  hasData: boolean;
  progressPercent: number;
  bonusCompleted?: number;
  bonusTotal?: number;
  bonusPercent?: number;
  activePlan: any;
  allPlans: any[];
  pendingSteps: any[];
  pendingDocs: any[];
  documentAlerts?: any[];
  docsReady?: number;
  docsTotal?: number;
  recentNotifications: any[];
  recentAchievements: any[];
  latestCRS: any;
  latestLanguageTests: any[];
  profiles: any[];
  awaitingSpouse?: boolean;
  macroMilestones?: MacroMilestoneWithStatus[];
  missingDocs?: any[];
}

const STAGE_CONFIG: Record<
  MacroMilestoneId,
  { Illustration: React.FC<{ className?: string; width?: number }>; tagline: string; Icon: any }
> = {
  research: { Illustration: ResearchStageIllustration, tagline: "Hora de pesquisar e mapear seu caminho", Icon: Search },
  language_tests: { Illustration: LanguageStageIllustration, tagline: "Foque no idioma — sua maior alavanca de score", Icon: Languages },
  eca: { Illustration: EcaStageIllustration, tagline: "Reuna diplomas e envie para avaliacao", Icon: GraduationCap },
  submission: { Illustration: SubmissionStageIllustration, tagline: "Hora de submeter — voce esta quase la", Icon: Send },
  approval: { Illustration: ApprovalStageIllustration, tagline: "Aguarde o convite — continue afiando seu CRS", Icon: PartyPopper },
  visa: { Illustration: VisaStageIllustration, tagline: "Documentos finais e exames medicos", Icon: Stamp },
  landing: { Illustration: LandingStageIllustration, tagline: "Prepare a mala — o Canada espera por voce", Icon: Plane },
  pr: { Illustration: PrStageIllustration, tagline: "Estabeleca-se com calma e estrategia", Icon: Home },
  citizenship: { Illustration: CitizenshipStageIllustration, tagline: "O ultimo passo: cidadao canadense", Icon: Flag },
};

const SHORT_NAMES: Record<MacroMilestoneId, string> = {
  research: "Pesquisa",
  language_tests: "Idioma",
  eca: "ECA",
  submission: "Submissao",
  approval: "Aprovacao",
  visa: "Visto",
  landing: "Landing",
  pr: "PR",
  citizenship: "Cidadania",
};

export function DashboardClient({
  userName,
  userImage,
  hasData,
  progressPercent,
  bonusCompleted,
  bonusTotal,
  activePlan,
  allPlans,
  pendingSteps,
  documentAlerts,
  docsReady = 0,
  docsTotal = 0,
  recentNotifications,
  recentAchievements,
  latestCRS,
  latestLanguageTests,
  profiles,
  awaitingSpouse,
  macroMilestones,
  missingDocs,
}: DashboardClientProps) {
  const firstName = userName.split(" ")[0];
  const currentIndex = macroMilestones ? getCurrentMilestoneIndex(macroMilestones) : 0;
  const currentMilestone = macroMilestones?.[currentIndex] || null;
  const nextMilestone = macroMilestones?.[currentIndex + 1] || null;
  const totalMs = macroMilestones?.length || 9;

  const stageId = (currentMilestone?.id as MacroMilestoneId) || "research";
  const stage = STAGE_CONFIG[stageId];
  const StageIllustration = stage.Illustration;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const today = new Date();
  const dateStr = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const currentDone = currentMilestone?.completedSteps || 0;
  const currentTotal = currentMilestone?.totalSteps || 0;
  const currentPct = currentTotal > 0 ? Math.round((currentDone / currentTotal) * 100) : 0;

  const focusSteps = pendingSteps.slice(0, 3);

  const bestTest = latestLanguageTests.length > 0
    ? latestLanguageTests.reduce((best: any, t: any) => {
        const score = parseFloat(t.overallScore || "0");
        const bestScore = parseFloat(best?.overallScore || "0");
        return score > bestScore ? t : best;
      }, latestLanguageTests[0])
    : null;

  const feed: { id: string; type: "achievement" | "notification"; title: string; meta: string; icon: any; date: Date }[] = [];
  recentAchievements.forEach((a: any) => {
    feed.push({
      id: `a-${a.id}`,
      type: "achievement",
      title: a.name || "Conquista",
      meta: `+${a.xpReward || 0} XP`,
      icon: Trophy,
      date: new Date(a.unlockedAt || a.createdAt),
    });
  });
  recentNotifications.forEach((n: any) => {
    feed.push({
      id: `n-${n.id}`,
      type: "notification",
      title: n.title,
      meta: formatDay(new Date(n.createdAt)),
      icon: Bell,
      date: new Date(n.createdAt),
    });
  });
  feed.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentFeed = feed.slice(0, 5);

  const insight = generateInsight(currentMilestone, nextMilestone, progressPercent, pendingSteps, docsReady, docsTotal);
  const hasAlerts = (documentAlerts && documentAlerts.length > 0) || awaitingSpouse;

  if (!hasData) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground">
          Bem-vindo, {firstName}!
        </h1>
        <p className="mx-auto mb-10 max-w-md text-base text-foreground-muted">
          Comece sua jornada para o Canada configurando seu perfil.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-light hover:shadow-md active:scale-[0.98]"
        >
          Comecar Onboarding
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ═══════ SECTION 1 — SMART HEADER ═══════ */}
      <section className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          {userImage && (
            <img
              src={userImage}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
          )}
          <div>
            <h1 className="text-lg font-bold text-foreground sm:text-xl">
              {greeting}, {firstName}
            </h1>
            <p className="text-xs text-foreground-muted capitalize">{dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {activePlan?.program?.name && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              <MapPin className="h-3 w-3" />
              {activePlan.program.name}
            </span>
          )}
          <MiniProgressRing value={progressPercent} />
        </div>
      </section>

      {/* ═══════ SECTION 2 — JOURNEY TIMELINE + CURRENT PHASE ═══════ */}
      <section className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto p-4 pb-3 sm:p-5 sm:pb-4">
          <div className="flex items-start min-w-max">
            {macroMilestones?.map((m, i) => {
              const isDone = m.status === "COMPLETED";
              const isCurrent = i === currentIndex;
              const StIcon = STAGE_CONFIG[m.id as MacroMilestoneId]?.Icon || Circle;
              const isLast = i === totalMs - 1;

              return (
                <div key={m.id} className="flex items-start">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center rounded-full border-2 transition-all ${
                        isDone
                          ? "h-9 w-9 border-emerald-500 bg-emerald-50 text-emerald-600"
                          : isCurrent
                          ? "h-11 w-11 border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
                          : "h-9 w-9 border-border/80 bg-surface/50 text-foreground-dim"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        <StIcon className={isCurrent ? "h-5 w-5" : "h-4 w-4"} />
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-[10px] font-semibold text-center leading-tight ${
                        isDone
                          ? "text-emerald-600"
                          : isCurrent
                          ? "text-primary"
                          : "text-foreground-dim"
                      }`}
                      style={{ width: 56 }}
                    >
                      {SHORT_NAMES[m.id as MacroMilestoneId]}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`mt-[18px] h-0.5 w-6 sm:w-10 ${
                        isDone ? "bg-emerald-400" : "bg-border/60"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/40 bg-surface/20 p-4 sm:p-5">
          <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Fase {currentIndex + 1} de {totalMs}
              </p>
              <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                {currentMilestone?.name || "Pesquisa"}
              </h2>
              <p className="mt-1.5 text-sm text-foreground-muted">{stage.tagline}</p>

              {currentTotal > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {currentDone}/{currentTotal} etapas
                    </span>
                    <span className="font-bold text-primary">{currentPct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${currentPct}%` }}
                    />
                  </div>
                </div>
              )}

              {(bonusTotal ?? 0) > 0 && (
                <p className="mt-2 text-[11px] text-foreground-dim">
                  +{bonusCompleted}/{bonusTotal} etapas bonus (planos B/C)
                </p>
              )}
            </div>
            <div className="flex w-full justify-center sm:w-auto sm:flex-shrink-0">
              <StageIllustration className="h-auto w-36 sm:w-44" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 3 — SMART INSIGHT ═══════ */}
      <section className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3.5 sm:p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{insight}</p>
          {nextMilestone && (
            <Link
              href="/journey"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-light"
            >
              Ver jornada completa
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </section>

      {/* ═══════ SECTION 4 — DAILY MISSIONS ═══════ */}
      <section className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Foco de hoje</h2>
          <Link
            href="/journey"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-light"
          >
            Ver tudo
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {focusSteps.length > 0 ? (
          <ul className="space-y-2">
            {focusSteps.map((step: any, i: number) => (
              <li key={step.id}>
                <Link
                  href={step.actionUrl || "/journey"}
                  className="group flex items-center gap-3 rounded-xl border border-border/40 p-3 transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0
                        ? "bg-primary/15 text-primary"
                        : "bg-surface text-foreground-dim"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {step.title}
                    </p>
                    {step.planPriority && step.planPriority !== "PRIMARY" && (
                      <span className="text-[10px] font-medium text-foreground-dim">
                        Plano {step.planPriority === "SECONDARY" ? "B" : "C"}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground-dim transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50/50 py-6 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
            <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Veja a jornada completa para planejar os proximos passos.
            </p>
          </div>
        )}
      </section>

      {/* ═══════ SECTION 5 — INTELLIGENCE GRID ═══════ */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {/* CRS Score */}
        <Link
          href="/simulator"
          className="group rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-5"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground-dim">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            CRS Score
          </div>
          {latestCRS?.totalScore ? (
            <>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">{latestCRS.totalScore}</span>
                <span className="text-sm font-semibold text-foreground-muted">pts</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.min(100, (latestCRS.totalScore / 1200) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-foreground-dim">de 1.200 pontos possiveis</p>
            </>
          ) : (
            <>
              <div className="mt-3">
                <span className="text-3xl font-bold text-foreground-dim">&mdash;</span>
              </div>
              <p className="mt-2 text-xs text-foreground-muted">Nenhuma simulacao ainda</p>
            </>
          )}
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary transition-all group-hover:gap-1.5">
            Simular agora
            <ChevronRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Documents */}
        <Link
          href="/documents"
          className="group rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-5"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground-dim">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Documentos
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-foreground">{docsReady}</span>
            <span className="text-sm font-semibold text-foreground-muted">/{docsTotal}</span>
          </div>
          {docsTotal > 0 && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-emerald-500/70"
                style={{ width: `${Math.round((docsReady / docsTotal) * 100)}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-[11px] text-foreground-dim">
            {docsTotal > 0
              ? `${docsTotal - docsReady} pendente${docsTotal - docsReady !== 1 ? "s" : ""}`
              : "Nenhum documento"}
          </p>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary transition-all group-hover:gap-1.5">
            Gerenciar
            <ChevronRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Language tests OR Family card */}
        {bestTest ? (
          <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground-dim">
              <Languages className="h-3.5 w-3.5 text-primary" />
              Idioma
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">
                {bestTest.overallScore || "—"}
              </span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {bestTest.testType}
              </span>
            </div>
            {bestTest.clbEquivalent && (
              <p className="mt-2 text-[11px] text-foreground-dim">
                CLB {bestTest.clbEquivalent}
              </p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-1">
              {[
                { label: "L", value: bestTest.listening },
                { label: "R", value: bestTest.reading },
                { label: "W", value: bestTest.writing },
                { label: "S", value: bestTest.speaking },
              ].map((b) => (
                <div key={b.label} className="text-center">
                  <p className="text-[10px] font-semibold text-foreground-dim">{b.label}</p>
                  <p className="text-xs font-bold text-foreground">{b.value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Link
            href="/settings/household"
            className="group rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-5"
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground-dim">
              <Users className="h-3.5 w-3.5 text-primary" />
              Familia
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">{profiles.length}</span>
              <span className="text-sm font-semibold text-foreground-muted">
                {profiles.length === 1 ? "perfil" : "perfis"}
              </span>
            </div>
            {awaitingSpouse ? (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Conjuge pendente
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-foreground-dim">
                {allPlans.length} plano{allPlans.length !== 1 ? "s" : ""} ativo{allPlans.length !== 1 ? "s" : ""}
              </p>
            )}
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary transition-all group-hover:gap-1.5">
              Gerenciar
              <ChevronRight className="h-3 w-3" />
            </div>
          </Link>
        )}
      </section>

      {/* ═══════ SECTION 6 — ALERTS ═══════ */}
      {hasAlerts && (
        <section className="space-y-2">
          {awaitingSpouse && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Perfil de conjuge pendente</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Adicione o perfil do conjuge para calcular CRS combinado.
                </p>
                <Link
                  href="/settings/household"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
                >
                  Adicionar agora
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
          {documentAlerts?.map((alert: any, i: number) => (
            <div
              key={alert.documentId || `alert-${i}`}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{alert.title}</p>
                <p className="mt-0.5 text-xs text-amber-700">{alert.message}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ═══════ SECTION 7 — MISSING DOCS ═══════ */}
      {missingDocs && missingDocs.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Documentos faltando</h2>
            <Link
              href="/documents"
              className="text-xs font-semibold text-primary hover:text-primary-light"
            >
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {missingDocs.map((md: any) => (
              <div
                key={md.doc.type}
                className="flex items-center gap-3 rounded-xl border border-dashed border-border/60 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface">
                  <FileText className="h-4 w-4 text-foreground-dim" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{md.doc.label}</p>
                  <p className="text-[10px] text-foreground-dim">
                    {md.existing}/{md.needed} enviado{md.needed > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ SECTION 8 — ACTIVITY FEED ═══════ */}
      {recentFeed.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Atividade recente</h2>
            <Link
              href="/notifications"
              className="text-xs font-semibold text-primary hover:text-primary-light"
            >
              Historico
            </Link>
          </div>
          <ul className="space-y-2.5">
            {recentFeed.map((item) => {
              const Icon = item.icon;
              const isAchievement = item.type === "achievement";
              return (
                <li key={item.id} className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isAchievement ? "bg-primary/10" : "bg-surface"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        isAchievement ? "text-primary" : "text-foreground-muted"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{item.title}</p>
                    <p className="text-[11px] text-foreground-dim">{item.meta}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ═══════ SECTION 9 — QUICK ACTIONS ═══════ */}
      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { href: "/journey", icon: MapPin, label: "Jornada", color: "text-primary bg-primary/10" },
          { href: "/documents", icon: FileText, label: "Docs", color: "text-emerald-600 bg-emerald-50" },
          { href: "/simulator", icon: Sparkles, label: "CRS", color: "text-violet-600 bg-violet-50" },
          { href: "/jobs", icon: Briefcase, label: "Vagas", color: "text-sky-600 bg-sky-50" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-4"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
              <action.icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">{action.label}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

function MiniProgressRing({ value }: { value: number }) {
  const size = 44;
  const sw = 3.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-surface" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          className="text-primary"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-foreground">{value}%</span>
      </div>
    </div>
  );
}

function generateInsight(
  current: MacroMilestoneWithStatus | null,
  next: MacroMilestoneWithStatus | null,
  progress: number,
  steps: any[],
  docsReady: number,
  docsTotal: number,
): string {
  const remaining = (current?.totalSteps || 0) - (current?.completedSteps || 0);

  if (remaining > 0 && remaining <= 3 && next) {
    return `Faltam apenas ${remaining} etapa${remaining > 1 ? "s" : ""} para avancar para "${next.name}". Voce esta quase la!`;
  }
  if (remaining > 0 && next) {
    return `Complete ${remaining} etapa${remaining > 1 ? "s" : ""} nesta fase para avancar para "${next.name}".`;
  }
  if (progress >= 80) {
    return "Voce esta na reta final da jornada! Continue focado nos ultimos passos.";
  }
  if (steps.length === 0) {
    return "Parabens! Todas as etapas em dia. Revise sua jornada para planejar os proximos passos.";
  }
  if (docsTotal > 0 && docsReady < docsTotal) {
    const missing = docsTotal - docsReady;
    return `Voce tem ${missing} documento${missing > 1 ? "s" : ""} pendente${missing > 1 ? "s" : ""}. Documentacao completa acelera aprovacoes.`;
  }
  return `Voce tem ${steps.length} etapa${steps.length > 1 ? "s" : ""} pendente${steps.length > 1 ? "s" : ""}. Foque nas prioridades do dia.`;
}

function formatDay(d: Date) {
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
