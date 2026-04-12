import { NextResponse } from "next/server";
import {
  appendLiveHiringTranscriptByToken,
  bumpRecordingMessageCountByLiveToken,
  getRecordingForLiveCandidate,
} from "@/lib/recordings";

const BASE = (process.env.INTERVIEW_BRAIN_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type Body = {
  brainSessionId?: string;
  answer?: string;
  recordingId?: string;
  liveBumpToken?: string;
  liveSessionId?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brainSessionId = typeof body.brainSessionId === "string" ? body.brainSessionId.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!brainSessionId || !answer) {
    return NextResponse.json({ error: "brainSessionId and answer required" }, { status: 400 });
  }

  const recordingId = typeof body.recordingId === "string" ? body.recordingId.trim() : "";
  const liveBumpToken = typeof body.liveBumpToken === "string" ? body.liveBumpToken.trim() : "";
  const liveSessionId = typeof body.liveSessionId === "string" ? body.liveSessionId.trim() : "";

  if (recordingId && liveBumpToken) {
    const rec = await getRecordingForLiveCandidate(recordingId, liveBumpToken);
    if (!rec) {
      return NextResponse.json({ error: "Invalid recording or token" }, { status: 403 });
    }
    if (rec.liveSessionId && liveSessionId && rec.liveSessionId !== liveSessionId) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }
    await bumpRecordingMessageCountByLiveToken(recordingId, liveBumpToken, 2);
  }

  try {
    const res = await fetch(`${BASE}/session/${encodeURIComponent(brainSessionId)}/turn`, {
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
    const reply = typeof data.response === "string" ? data.response.trim() : "";
    if (recordingId && liveBumpToken && reply) {
      await appendLiveHiringTranscriptByToken(recordingId, liveBumpToken, [
        { role: "candidate", text: answer },
        { role: "interviewer", text: reply },
      ]);
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("live-interview/brain/turn:", e);
    return NextResponse.json(
      {
        error:
          "Could not reach the interview brain API. Start it with: uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000",
      },
      { status: 502 }
    );
  }
}
