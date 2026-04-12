import { NextRequest, NextResponse } from "next/server";
import { mlEngineServerBase } from "@/lib/ml-engine";

type Turn = { role: "candidate" | "interviewer"; text: string };

function normalizeRole(raw: string): "candidate" | "interviewer" {
  const r = raw.toLowerCase();
  if (r.includes("interview") || r === "assistant" || r === "model" || r === "ai" || r === "system")
    return "interviewer";
  return "candidate";
}

function normalizeConversation(json: unknown): Turn[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const raw = o.conversation ?? o.messages ?? o.history ?? o.transcript ?? o.turns;
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const roleRaw = String(m.role ?? m.speaker ?? m.from ?? "");
    const text = String(m.text ?? m.content ?? m.message ?? m.body ?? "").trim();
    if (!text) continue;
    out.push({ role: normalizeRole(roleRaw), text });
  }
  return out;
}

/** Try several ML paths; return first non-empty conversation. */
export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidateId")?.trim();
  if (!candidateId) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }

  const paths = [
    `/session/conversation?candidate_id=${encodeURIComponent(candidateId)}`,
    `/session/transcript?candidate_id=${encodeURIComponent(candidateId)}`,
    `/conversation?candidate_id=${encodeURIComponent(candidateId)}`,
  ];

  const mlBase = mlEngineServerBase();
  for (const path of paths) {
    try {
      const res = await fetch(`${mlBase}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json: unknown = await res.json();
      const turns = normalizeConversation(json);
      if (turns.length > 0) {
        return NextResponse.json({ turns, source: path });
      }
    } catch {
      /* try next path */
    }
  }

  try {
    const res = await fetch(`${mlBase}/session/report?candidate_id=${encodeURIComponent(candidateId)}&candidate_name=Candidate`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const json: unknown = await res.json();
      const turns = normalizeConversation(json);
      if (turns.length > 0) {
        return NextResponse.json({ turns, source: "report" });
      }
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({ turns: [] as Turn[], source: null });
}
