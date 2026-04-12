import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const BASE = (process.env.INTERVIEW_BRAIN_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { knowledge?: string; mode?: string };
  try {
    body = (await req.json()) as { knowledge?: string; mode?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const knowledge =
    typeof body.knowledge === "string" && body.knowledge.trim().length > 0
      ? body.knowledge.trim()
      : "Mock interview session.";
  const mode = body.mode === "behavioral" ? "behavioral" : "full";

  try {
    const res = await fetch(`${BASE}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledge, mode }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? JSON.stringify(data.detail)
            : "Interview brain error";
      return NextResponse.json({ error: detail, detail: data }, { status: res.status >= 500 ? 502 : res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("interview-brain/start:", e);
    return NextResponse.json(
      {
        error:
          "Could not reach the interview brain API. Start it with: uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000",
      },
      { status: 502 }
    );
  }
}
