import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { jobApplications, jobPreferences, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveHouseholdId } from "@/lib/resolve-household";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { appId, type } = body; // type: "cover_letter" | "cv_tips" | "both"

  const app = await db.query.jobApplications.findFirst({
    where: and(eq(jobApplications.id, appId), eq(jobApplications.householdId, householdId)),
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get profile info
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, app.profileId),
    with: { languageTests: true, crsScores: true },
  });

  const prefs = await db.query.jobPreferences.findFirst({
    where: eq(jobPreferences.profileId, app.profileId),
  });

  const profileContext = `
Candidato: ${profile?.firstName} ${profile?.lastName}
Area: ${prefs?.jobTitles?.join(", ") || "Product Designer"}
CV/Experiencia: ${prefs?.cvText || "Product Designer com experiencia em UX, interfaces digitais e sistemas de design."}
  `.trim();

  const jobContext = `
Vaga: ${app.jobTitle}
Empresa: ${app.company}
Localizacao: ${app.location || "Atlantic Canada"}
Salario: ${app.salary || "A negociar"}
Descricao: ${app.jobDescription?.slice(0, 1500) || ""}
  `.trim();

  let coverLetter: string | undefined;
  let cvTips: string | undefined;
  let compatibilityScore: number | undefined;

  if (type === "cover_letter" || type === "both") {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Escreva uma cover letter profissional e personalizada em ingles para esta vaga de imigração no Canada (Atlantic Immigration Program).

${profileContext}

${jobContext}

Instrucoes:
- Tom profissional mas humano
- Mencione o Atlantic Immigration Program quando relevante
- Maximo 3 paragrafos curtos
- Enfatize motivacao para morar no Canada Atlantico
- Comece com "Dear Hiring Manager,"
- Termine com "Sincerely, ${profile?.firstName} ${profile?.lastName}"`,
      }],
    });
    coverLetter = (msg.content[0] as any).text;
  }

  if (type === "cv_tips" || type === "both") {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Analise a compatibilidade e sugira 3-5 melhorias pontuais no CV para esta vaga:

${profileContext}

${jobContext}

Responda em portugues. Formato:
SCORE: [numero de 0-100]
DICAS:
- [dica 1]
- [dica 2]
...`,
      }],
    });
    const raw = (msg.content[0] as any).text as string;
    cvTips = raw;

    // Extract score
    const scoreMatch = raw.match(/SCORE:\s*(\d+)/);
    if (scoreMatch) compatibilityScore = parseInt(scoreMatch[1]);
  }

  // Save to DB
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (coverLetter) updateData.generatedCoverLetter = coverLetter;
  if (cvTips) updateData.cvTips = cvTips;
  if (compatibilityScore !== undefined) updateData.compatibilityScore = compatibilityScore;

  await db.update(jobApplications).set(updateData).where(eq(jobApplications.id, appId));

  return NextResponse.json({ coverLetter, cvTips, compatibilityScore });
}
