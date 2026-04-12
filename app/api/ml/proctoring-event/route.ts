import { NextRequest, NextResponse } from "next/server";
import { mlEngineServerBase } from "@/lib/ml-engine";

/**
 * Forwards browser proctoring flags from the candidate app to the ML engine so the live monitor
 * can show the same session’s integrity timeline (`GET .../session/proctoring/...`).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const candidateId = typeof o.candidateId === "string" ? o.candidateId.trim() : "";
  const event = o.event;
  if (!candidateId || !event || typeof event !== "object") {
    return NextResponse.json({ error: "candidateId and event required" }, { status: 400 });
  }

  const base = mlEngineServerBase();
  const q = `candidate_id=${encodeURIComponent(candidateId)}`;
  const paths = [`/session/proctoring/event?${q}`, `/session/proctoring?${q}`];

  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(event),
      });
      if (res.ok) {
        return NextResponse.json({ forwarded: true });
      }
    } catch {
      /* try next path */
    }
  }

  return NextResponse.json(
    { forwarded: false, note: "ML engine did not accept proctoring event (endpoint may be unimplemented)." },
    { status: 200 }
  );
}
