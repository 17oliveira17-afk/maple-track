import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { jobApplications, jobPreferences, profiles, autoApplyLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveHouseholdId } from "@/lib/resolve-household";
import { Resend } from "resend";
import { getJobApplyInfo } from "@/lib/job-bank";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── AI Provider (same as generate route) ───
async function generateText(prompt: string): Promise<string> {
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
    } catch (e) {
      console.log("[AUTO-APPLY] Anthropic error:", e);
    }
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  throw new Error("No AI provider configured");
}

// POST — auto-apply to one or multiple jobs
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await resolveHouseholdId(session.user);
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { jobs, profileId } = body;

  // jobs = array of { id, title, company, location, salary, url, description, source, program }
  if (!Array.isArray(jobs) || jobs.length === 0 || !profileId) {
    return NextResponse.json({ error: "jobs[] and profileId required" }, { status: 400 });
  }

  // Verify profile
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, profileId), eq(profiles.householdId, householdId)),
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Get CV text
  const prefs = await db.query.jobPreferences.findFirst({
    where: eq(jobPreferences.profileId, profileId),
  });
  const cvText = prefs?.cvText || "";

  const results: {
    jobId: string;
    jobTitle: string;
    company: string;
    status: "applied" | "saved" | "failed";
    method: "email" | "direct" | "manual";
    message: string;
    applicationId?: string;
  }[] = [];

  for (const job of jobs) {
    try {
      // 1. Check for duplicates
      let existingApp = null;
      if (job.id) {
        existingApp = await db.query.jobApplications.findFirst({
          where: and(
            eq(jobApplications.externalId, job.id),
            eq(jobApplications.profileId, profileId),
          ),
        });
      }

      // 2. Try to get email from Job Bank jobs
      let applyEmail: string | null = null;
      let applyInfo = null;
      let contactName: string | null = null;

      if (job.id?.startsWith("jb-")) {
        const numericId = job.id.replace("jb-", "");
        applyInfo = await getJobApplyInfo(numericId);
        applyEmail = applyInfo.email;
        contactName = applyInfo.contactName;

        // Update description if we got a better one
        if (applyInfo.description && (!job.description || job.description.length < 100)) {
          job.description = applyInfo.description;
        }
      }

      // Also check for email in job description (any source)
      if (!applyEmail && job.description) {
        const emailMatch = job.description.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        if (emailMatch) {
          const email = emailMatch[0];
          if (!email.includes("noreply") && !email.includes("donotreply")) {
            applyEmail = email;
          }
        }
      }

      // 3. Generate cover letter with AI
      let coverLetter = "";
      try {
        const profileContext = `
Candidato: ${profile.firstName} ${profile.lastName}
CV/Experiencia:
${cvText || "Profissional experiente buscando oportunidades no Canada."}
        `.trim();

        const jobContext = `
Vaga: ${job.title}
Empresa: ${job.company}
Localizacao: ${job.location || "Canada"}
Salario: ${job.salary || "A negociar"}
Descricao: ${(job.description || "").slice(0, 1500)}
        `.trim();

        coverLetter = await generateText(`Write a professional, personalized cover letter in English for this job position in Canada.

${profileContext}

${jobContext}

Instructions:
- Professional but human tone
- If the job is in Atlantic Canada, mention the Atlantic Immigration Program
- 3-4 short paragraphs
- Highlight relevant skills from the CV
- Start with "Dear ${contactName || "Hiring Manager"},"
- End with "Sincerely, ${profile.firstName} ${profile.lastName}"
- Make it specific to this company and role`);
      } catch (e) {
        console.error("[AUTO-APPLY] AI generation failed:", e);
        coverLetter = `Dear ${contactName || "Hiring Manager"},

I am writing to express my strong interest in the ${job.title} position at ${job.company}. With my professional experience and skills, I believe I would be a valuable addition to your team.

I am currently in the process of immigrating to Canada and am excited about the opportunity to contribute to your organization. I am highly motivated, adaptable, and eager to bring my expertise to this role.

I would welcome the opportunity to discuss how my skills and experience align with your needs. Thank you for considering my application.

Sincerely,
${profile.firstName} ${profile.lastName}`;
      }

      // 4. Save to pipeline (or update existing)
      let appId: string;

      if (existingApp) {
        appId = existingApp.id;
        await db.update(jobApplications)
          .set({
            generatedCoverLetter: coverLetter,
            coverLetterGeneratedAt: new Date(),
            jobDescription: job.description || existingApp.jobDescription,
            updatedAt: new Date(),
          })
          .where(eq(jobApplications.id, appId));
      } else {
        const [newApp] = await db.insert(jobApplications).values({
          profileId,
          householdId,
          externalId: job.id || null,
          jobTitle: job.title,
          company: job.company,
          location: job.location,
          salary: job.salary,
          jobUrl: job.url,
          jobDescription: job.description,
          isAip: job.program === "AIP",
          status: "PREPARING",
          generatedCoverLetter: coverLetter,
          coverLetterGeneratedAt: new Date(),
        }).returning();
        appId = newApp.id;
      }

      // 5. Apply via email if we have one
      if (applyEmail) {
        try {
          await resend.emails.send({
            from: `${profile.firstName} ${profile.lastName} via MapleTrack <onboarding@resend.dev>`,
            to: applyEmail,
            subject: `Application for ${job.title} — ${profile.firstName} ${profile.lastName}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
                ${coverLetter.split("\n").map((p) => p.trim() ? `<p style="margin: 0 0 12px 0; line-height: 1.6;">${p}</p>` : "").join("")}
                ${cvText ? `
                  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
                  <p style="font-size: 12px; color: #888; margin: 0 0 8px 0;"><strong>Resume / CV:</strong></p>
                  <div style="font-size: 12px; color: #444; white-space: pre-wrap; background: #f9f9f9; padding: 16px; border-radius: 8px; line-height: 1.5;">
${cvText.slice(0, 3000)}
                  </div>
                ` : ""}
              </div>
            `,
          });

          // Mark as applied with proof
          await db.update(jobApplications)
            .set({
              status: "APPLIED",
              appliedAt: new Date(),
              appliedVia: "email",
              appliedToEmail: applyEmail,
              updatedAt: new Date(),
            })
            .where(eq(jobApplications.id, appId));

          // Log success
          await db.insert(autoApplyLogs).values({
            applicationId: appId,
            userId: session.user.id,
            site: job.source?.includes("Job Bank") ? "JOBBANK" : "OTHER",
            status: "SUCCESS",
            jobUrl: job.url,
            formData: { method: "email", to: applyEmail },
          });

          results.push({
            jobId: job.id,
            jobTitle: job.title,
            company: job.company,
            status: "applied",
            method: "email",
            message: `Email enviado para ${applyEmail}`,
            applicationId: appId,
          });

          continue;
        } catch (emailError) {
          console.error("[AUTO-APPLY] Email send failed:", emailError);
          // Fall through to save as prepared
        }
      }

      // 6. If no email available or email failed — save as prepared with cover letter
      await db.update(jobApplications)
        .set({
          status: "PREPARING",
          generatedCoverLetter: coverLetter,
          updatedAt: new Date(),
        })
        .where(eq(jobApplications.id, appId));

      // Log
      await db.insert(autoApplyLogs).values({
        applicationId: appId,
        userId: session.user.id,
        site: job.source?.includes("LinkedIn") ? "LINKEDIN"
            : job.source?.includes("Indeed") ? "INDEED"
            : job.source?.includes("Job Bank") ? "JOBBANK"
            : "OTHER",
        status: "PARTIAL",
        jobUrl: job.url,
        formData: { method: "manual", reason: "No email found — cover letter generated" },
      });

      results.push({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        status: "saved",
        method: "manual",
        message: "Cover letter gerada. Aplique manualmente com o conteúdo preparado.",
        applicationId: appId,
      });
    } catch (error) {
      console.error(`[AUTO-APPLY] Error processing ${job.title}:`, error);

      // Log failure
      await db.insert(autoApplyLogs).values({
        userId: session.user.id,
        site: "OTHER",
        status: "FAILED",
        jobUrl: job.url,
        errorMessage: String(error),
      });

      results.push({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        status: "failed",
        method: "manual",
        message: `Erro: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  const applied = results.filter((r) => r.status === "applied").length;
  const saved = results.filter((r) => r.status === "saved").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      applied,
      saved,
      failed,
    },
  });
}
