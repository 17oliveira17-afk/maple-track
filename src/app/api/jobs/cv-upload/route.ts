import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractText } from "unpdf";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const ext = file.name.toLowerCase().split(".").pop();
  const allowedExts = ["pdf", "docx", "doc", "txt"];

  if (!allowedExts.includes(ext || "")) {
    return NextResponse.json(
      { error: "Formato não suportado. Use PDF, DOCX ou TXT." },
      { status: 400 }
    );
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 5MB." }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    let text = "";

    if (ext === "pdf") {
      // unpdf works in serverless — no native dependencies
      const { text: pdfText } = await extractText(arrayBuffer, { mergePages: true });
      text = typeof pdfText === "string" ? pdfText : (pdfText as string[]).join("\n\n");
    } else if (ext === "docx" || ext === "doc") {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // txt or fallback
      text = Buffer.from(arrayBuffer).toString("utf-8");
    }

    // Clean up
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: "Não foi possível extrair texto do arquivo. Tente colar manualmente." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: text.slice(0, 10000),
      filename: file.name,
      charCount: text.length,
    });
  } catch (e) {
    console.error("[CV_UPLOAD] parse error:", e);
    return NextResponse.json(
      { error: "Erro ao processar arquivo. Tente colar manualmente." },
      { status: 500 }
    );
  }
}
