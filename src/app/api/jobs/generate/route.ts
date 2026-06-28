import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { jobApplications, jobPreferences, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveHouseholdId } from "@/lib/resolve-household";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── AI Provider: tries Anthropic first, falls back to Gemini ───
async function generateText(prompt: string): Promise<string> {
  // Try Anthropic first (paid)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text || "";
      }
      console.log("[GENERATE] Anthropic failed, falling back to Gemini");
    } catch (e) {
      console.log("[GENERATE] Anthropic error, falling back to Gemini:", e);
    }
  }

  // Fallback: Gemini (free)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  throw new Error("No AI provider configured");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { appId, type } = body;

  const app = await db.query.jobApplications.findFirst({
    where: and(eq(jobApplications.id, appId), eq(jobApplications.householdId, householdId)),
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, app.profileId),
    with: { languageTests: true, crsScores: true },
  });

  const prefs = await db.query.jobPreferences.findFirst({
    where: eq(jobPreferences.profileId, app.profileId),
  });

  const cvText = prefs?.cvText || "";
  const profileContext = `
Candidato: ${profile?.firstName} ${profile?.lastName}
Area: ${prefs?.jobTitles?.join(", ") || (profile?.isPrimaryApplicant ? "Product Designer" : "Early Childhood Educator")}
CV/Experiencia:
${cvText || "Nenhum CV informado — use as informacoes da vaga para gerar conteudo generico profissional."}
  `.trim();

  const jobContext = `
Vaga: ${app.jobTitle}
Empresa: ${app.company}
Localizacao: ${app.location || "Canada"}
Salario: ${app.salary || "A negociar"}
Descricao: ${app.jobDescription?.slice(0, 1500) || ""}
  `.trim();

  let coverLetter: string | undefined;
  let cvTips: string | undefined;
  let compatibilityScore: number | undefined;

  try {
    if (type === "cover_letter" || type === "both") {
      coverLetter = await generateText(`Write a professional, personalized cover letter in English for this job position in Canada.

${profileContext}

${jobContext}

Instructions:
- Professional but human tone
- If the job is in Atlantic Canada, mention the Atlantic Immigration Program
- 3-4 short paragraphs
- Highlight relevant skills from the CV that match the job description
- Show genuine motivation for the role and location
- Start with "Dear Hiring Manager,"
- End with "Sincerely, ${profile?.firstName} ${profile?.lastName}"
- If a CV was provided, reference specific experiences/skills from it
- Make it specific to this company and role, not generic`);
    }

    if (type === "cv_tips" || type === "both") {
      const raw = await generateText(`Analyze the compatibility and suggest 3-5 specific CV improvements for this job application.

${profileContext}

${jobContext}

Respond in Portuguese (pt-BR). Format:
SCORE: [number 0-100 based on how well the CV matches the job]
DICAS:
- [specific, actionable tip 1 — reference the job description]
- [specific, actionable tip 2]
- [tip 3]
...

Be specific — mention which skills/keywords from the job description should be added to the CV.
If no CV was provided, give a lower score and suggest what to include.`);

      cvTips = raw;
      const scoreMatch = raw.match(/SCORE:\s*(\d+)/);
      if (scoreMatch) compatibilityScore = parseInt(scoreMatch[1]);
    }
  } catch (e) {
    console.error("[GENERATE] AI error:", e);
    return NextResponse.json({ error: "Erro ao gerar conteúdo com IA" }, { status: 500 });
  }

  // Save to DB
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (coverLetter) {
    updateData.generatedCoverLetter = coverLetter;
    updateData.coverLetterGeneratedAt = new Date();
  }
  if (cvTips) updateData.cvTips = cvTips;
  if (compatibilityScore !== undefined) updateData.compatibilityScore = compatibilityScore;

  await db.update(jobApplications).set(updateData).where(eq(jobApplications.id, appId));

  return NextResponse.json({ coverLetter, cvTips, compatibilityScore });
}
