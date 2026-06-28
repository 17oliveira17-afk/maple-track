"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key, Copy, Trash2, Plus, Loader2, CheckCircle2, Shield,
  Chrome, Globe, Puzzle, Clock, AlertCircle, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, HelpCircle,
} from "lucide-react";

// ─── Types ───

interface ExtensionToken {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ScreeningAnswer {
  id?: string;
  question: string;
  answer: string;
  category: string;
}

interface AutoApplyLog {
  id: string;
  site: string;
  status: string;
  jobUrl: string | null;
  errorMessage: string | null;
  attemptedAt: string;
}

interface Profile {
  id: string;
  firstName: string | null;
  isPrimaryApplicant: boolean | null;
}

const SCREENING_CATEGORIES = [
  { value: "WORK_AUTHORIZATION", label: "Autorização de trabalho" },
  { value: "EXPERIENCE", label: "Experiência" },
  { value: "EDUCATION", label: "Educação" },
  { value: "LANGUAGES", label: "Idiomas" },
  { value: "AVAILABILITY", label: "Disponibilidade" },
  { value: "SALARY", label: "Salário" },
  { value: "RELOCATION", label: "Realocação" },
  { value: "OTHER", label: "Outro" },
];

// Default screening questions for Canadian immigration
const DEFAULT_QUESTIONS: ScreeningAnswer[] = [
  { question: "Are you authorized to work in Canada?", answer: "Yes, with work permit", category: "WORK_AUTHORIZATION" },
  { question: "Do you require sponsorship?", answer: "Yes, I require employer sponsorship for a work permit", category: "WORK_AUTHORIZATION" },
  { question: "Are you eligible to work in Canada?", answer: "Yes", category: "WORK_AUTHORIZATION" },
  { question: "Years of experience", answer: "8", category: "EXPERIENCE" },
  { question: "Highest level of education", answer: "Bachelor's degree", category: "EDUCATION" },
  { question: "English proficiency", answer: "Fluent / Professional", category: "LANGUAGES" },
  { question: "French proficiency", answer: "Basic / Beginner", category: "LANGUAGES" },
  { question: "When can you start?", answer: "Immediately / Within 2 weeks", category: "AVAILABILITY" },
  { question: "Are you willing to relocate?", answer: "Yes", category: "RELOCATION" },
  { question: "Expected salary", answer: "Open to discussion based on the role", category: "SALARY" },
];

const SITE_COLORS: Record<string, string> = {
  LINKEDIN: "bg-blue-100 text-blue-700",
  INDEED: "bg-purple-100 text-purple-700",
  JOBBANK: "bg-primary/10 text-primary",
  OTHER: "bg-surface text-foreground-muted",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "bg-success/10", text: "text-success" },
  PARTIAL: { bg: "bg-warning/10", text: "text-warning" },
  FAILED: { bg: "bg-red-100", text: "text-red-600" },
  SKIPPED: { bg: "bg-surface", text: "text-foreground-dim" },
};

// ─── Component ───

export function ExtensionTab({ profiles }: { profiles: Profile[] }) {
  // Token state
  const [tokens, setTokens] = useState<ExtensionToken[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);

  // Screening answers state
  const [answers, setAnswers] = useState<ScreeningAnswer[]>([]);
  const [activeProfile, setActiveProfile] = useState(
    profiles.find((p) => p.isPrimaryApplicant)?.id || profiles[0]?.id || ""
  );
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<AutoApplyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Section visibility
  const [showInstall, setShowInstall] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // ─── Load data ───

  const loadTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const r = await fetch("/api/extension/token");
      const data = await r.json();
      setTokens(Array.isArray(data) ? data : []);
    } catch {
      setTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  const loadAnswers = useCallback(async () => {
    try {
      const r = await fetch("/api/extension/answers");
      const data = await r.json();
      const profileData = data.find?.((d: { profileId: string }) => d.profileId === activeProfile);
      setAnswers(profileData?.answers || []);
    } catch {
      setAnswers([]);
    }
  }, [activeProfile]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const r = await fetch("/api/extension/report");
      const data = await r.json();
      setLogs(Array.isArray(data) ? data : Array.isArray(data?.logs) ? data.logs : []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);
  useEffect(() => { if (showAnswers) loadAnswers(); }, [showAnswers, loadAnswers]);
  useEffect(() => { if (showLogs) loadLogs(); }, [showLogs, loadLogs]);

  // ─── Token actions ───

  async function createToken() {
    if (!newTokenName.trim()) return;
    setCreatingToken(true);
    try {
      const r = await fetch("/api/extension/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      const data = await r.json();
      setNewlyCreatedToken(data.token);
      setNewTokenName("");
      loadTokens();
    } finally {
      setCreatingToken(false);
    }
  }

  async function deleteToken(tokenId: string) {
    await fetch("/api/extension/token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId }),
    });
    loadTokens();
  }

  function copyToken() {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  }

  // ─── Screening answers actions ───

  function addAnswer() {
    setAnswers((prev) => [...prev, { question: "", answer: "", category: "OTHER" }]);
  }

  function updateAnswer(index: number, field: keyof ScreeningAnswer, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function removeAnswer(index: number) {
    setAnswers((prev) => prev.filter((_, i) => i !== index));
  }

  function loadDefaults() {
    setAnswers(DEFAULT_QUESTIONS);
  }

  async function saveAnswers() {
    setSavingAnswers(true);
    setSavedAnswers(false);
    try {
      await fetch("/api/extension/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeProfile, answers }),
      });
      setSavedAnswers(true);
      setTimeout(() => setSavedAnswers(false), 2000);
    } finally {
      setSavingAnswers(false);
    }
  }

  // ─── Render ───

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-primary" />
          Chrome Extension
        </h2>
        <p className="text-xs text-foreground-muted mt-0.5">
          Instale a extensão para preencher formulários automaticamente no LinkedIn, Indeed e Job Bank.
        </p>
      </div>

      {/* ─── Install Instructions ─── */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setShowInstall(!showInstall)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Chrome className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">Como instalar</span>
          </div>
          {showInstall ? <ChevronUp className="h-4 w-4 text-foreground-dim" /> : <ChevronDown className="h-4 w-4 text-foreground-dim" />}
        </button>

        {showInstall && (
          <div className="border-t border-border/40 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                { step: 1, title: "Baixe a extensão", desc: "Faça download da pasta chrome-extension do projeto" },
                { step: 2, title: "Carregue no Chrome", desc: "chrome://extensions → Modo desenvolvedor → Carregar sem compactação" },
                { step: 3, title: "Gere um token", desc: "Use o formulário abaixo para criar um token de acesso" },
                { step: 4, title: "Conecte", desc: "Cole o token no popup da extensão e clique Conectar" },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{s.title}</p>
                    <p className="text-[10px] text-foreground-muted mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-foreground-dim">
              <Globe className="h-3.5 w-3.5" />
              Sites suportados:
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">LinkedIn</span>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">Indeed</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Job Bank</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── API Tokens ─── */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border/40">
          <Key className="h-4 w-4 text-primary" />
          <span className="font-bold text-foreground">Tokens de Acesso</span>
          <span className="ml-auto text-[10px] text-foreground-dim">{tokens.length} token{tokens.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="p-4 space-y-3">
          {/* Newly created token */}
          {newlyCreatedToken && (
            <div className="rounded-xl border-2 border-success/40 bg-success/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-xs font-bold text-success">Token criado! Copie agora — ele não será mostrado novamente.</span>
              </div>
              <div className="flex gap-2">
                <code className="flex-1 rounded-lg bg-white border border-border/60 p-2.5 text-xs font-mono text-foreground break-all">
                  {newlyCreatedToken}
                </code>
                <button
                  onClick={copyToken}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                >
                  {copiedToken ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedToken ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <button
                onClick={() => setNewlyCreatedToken(null)}
                className="text-[10px] text-foreground-dim hover:text-foreground"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Create new token */}
          <div className="flex gap-2">
            <input
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createToken()}
              placeholder="Nome do token (ex: Chrome Desktop)"
              className="flex-1 rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
            <button
              onClick={createToken}
              disabled={creatingToken || !newTokenName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-primary/90"
            >
              {creatingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Gerar Token
            </button>
          </div>

          {/* Token list */}
          {loadingTokens ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-center text-xs text-foreground-dim py-4">
              Nenhum token criado ainda. Gere um para conectar a extensão.
            </p>
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface/20 px-3 py-2.5">
                  <Key className="h-3.5 w-3.5 shrink-0 text-foreground-dim" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{t.name}</p>
                    <p className="text-[10px] text-foreground-dim">
                      {t.lastUsedAt
                        ? `Último uso: ${new Date(t.lastUsedAt).toLocaleDateString("pt-BR")} ${new Date(t.lastUsedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                        : "Nunca usado"}
                      {" · "}Criado em {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteToken(t.id)}
                    className="shrink-0 rounded-lg p-1.5 text-foreground-dim hover:bg-red-50 hover:text-red-500"
                    title="Revogar token"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Screening Answers ─── */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">Respostas para Triagem</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {answers.length} resposta{answers.length !== 1 ? "s" : ""}
            </span>
          </div>
          {showAnswers ? <ChevronUp className="h-4 w-4 text-foreground-dim" /> : <ChevronDown className="h-4 w-4 text-foreground-dim" />}
        </button>

        {showAnswers && (
          <div className="border-t border-border/40 p-4 space-y-4">
            <p className="text-xs text-foreground-muted">
              Configure respostas padrão para perguntas comuns em formulários de emprego.
              A extensão usará essas respostas para preencher automaticamente.
            </p>

            {/* Profile selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-foreground-dim">Perfil:</span>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProfile(p.id)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                    activeProfile === p.id
                      ? "bg-primary text-white"
                      : "bg-surface text-foreground-muted hover:bg-primary/10"
                  }`}
                >
                  {p.firstName}
                </button>
              ))}
            </div>

            {/* Answers list */}
            <div className="space-y-2">
              {answers.map((a, i) => (
                <div key={i} className="flex gap-2 items-start rounded-xl border border-border/40 bg-surface/20 p-3">
                  <div className="flex-1 space-y-2">
                    <input
                      value={a.question}
                      onChange={(e) => updateAnswer(i, "question", e.target.value)}
                      placeholder="Pergunta (ex: Are you authorized to work in Canada?)"
                      className="w-full rounded-lg border border-border/40 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
                    />
                    <div className="flex gap-2">
                      <input
                        value={a.answer}
                        onChange={(e) => updateAnswer(i, "answer", e.target.value)}
                        placeholder="Resposta"
                        className="flex-1 rounded-lg border border-border/40 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
                      />
                      <select
                        value={a.category}
                        onChange={(e) => updateAnswer(i, "category", e.target.value)}
                        className="rounded-lg border border-border/40 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-primary/40"
                      >
                        {SCREENING_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => removeAnswer(i)}
                    className="shrink-0 rounded-lg p-1 text-foreground-dim hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={addAnswer}
                className="flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:border-primary/40 hover:text-primary"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
              {answers.length === 0 && (
                <button
                  onClick={loadDefaults}
                  className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <HelpCircle className="h-3 w-3" /> Carregar perguntas padrão
                </button>
              )}
              <div className="flex-1" />
              {savedAnswers && (
                <span className="flex items-center gap-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Salvo!
                </span>
              )}
              <button
                onClick={saveAnswers}
                disabled={savingAnswers}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-primary/90"
              >
                {savingAnswers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Salvar Respostas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Activity Log ─── */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">Atividade da Extensão</span>
          </div>
          {showLogs ? <ChevronUp className="h-4 w-4 text-foreground-dim" /> : <ChevronDown className="h-4 w-4 text-foreground-dim" />}
        </button>

        {showLogs && (
          <div className="border-t border-border/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-foreground-muted">Últimas atividades de auto-preenchimento</p>
              <button
                onClick={loadLogs}
                disabled={loadingLogs}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <RefreshCw className={`h-3 w-3 ${loadingLogs ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 py-6 text-center">
                <Clock className="mx-auto mb-2 h-6 w-6 text-foreground-dim" />
                <p className="text-xs text-foreground-dim">Nenhuma atividade ainda</p>
                <p className="text-[10px] text-foreground-dim mt-1">
                  As atividades aparecerão aqui quando você usar a extensão
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {logs.map((log) => {
                  const statusStyle = STATUS_COLORS[log.status] || STATUS_COLORS.SKIPPED;
                  const siteClass = SITE_COLORS[log.site] || SITE_COLORS.OTHER;

                  return (
                    <div key={log.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface/20 px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${siteClass}`}>
                        {log.site}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text}`}>
                        {log.status === "SUCCESS" ? "Sucesso" : log.status === "PARTIAL" ? "Parcial" : log.status === "FAILED" ? "Falha" : "Pulado"}
                      </span>
                      <div className="flex-1 min-w-0">
                        {log.jobUrl && (
                          <a
                            href={log.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline truncate block"
                          >
                            {log.jobUrl.slice(0, 50)}...
                          </a>
                        )}
                        {log.errorMessage && (
                          <p className="text-[10px] text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-2.5 w-2.5" />
                            {log.errorMessage}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-foreground-dim">
                        {new Date(log.attemptedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-border/40 bg-surface/30 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim mb-1.5">Como funciona</p>
        <ul className="space-y-1">
          {[
            "A extensão detecta páginas de vagas no LinkedIn, Indeed e Job Bank",
            "Preenche automaticamente seus dados e cover letter gerada pela IA",
            "Respostas de triagem são preenchidas com base nas configurações acima",
            "Você revisa e confirma antes de enviar — nunca submete automaticamente",
            "Todas as ações são registradas no log de atividade",
          ].map((tip, i) => (
            <li key={i} className="flex gap-2 text-[11px] text-foreground-muted">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
