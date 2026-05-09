import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchJobBank } from "@/lib/job-bank";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("q") || "";
  const provinces = searchParams.get("provinces")?.split(",") || ["NB", "NS", "PE", "NL"];
  const page = Number(searchParams.get("page") || "1");

  if (!keywords.trim()) return NextResponse.json([]);

  const jobs = await searchJobBank({ keywords, provinces, page });
  return NextResponse.json(jobs);
}
