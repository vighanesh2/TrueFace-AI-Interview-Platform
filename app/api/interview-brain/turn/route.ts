import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const BASE = (process.env.INTERVIEW_BRAIN_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; answer?: string };
  try {
    body = (await req.json()) as { sessionId?: string; answer?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!sessionId || !answer) {
    return NextResponse.json({ error: "sessionId and answer are required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/session/${encodeURIComponent(sessionId)}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
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
    console.error("interview-brain/turn:", e);
    return NextResponse.json(
      {
        error:
          "Could not reach the interview brain API. Start it with: uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000",
      },
      { status: 502 }
    );
  }
}
