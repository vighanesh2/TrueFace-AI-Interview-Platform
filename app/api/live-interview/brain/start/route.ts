import { NextResponse } from "next/server";
import { buildInterviewKnowledge } from "@/lib/interview-context";
import { LIVE_INTERVIEW_QUESTION_FOCUS } from "@/lib/live-interview-focus";
import {
  appendLiveHiringTranscriptByToken,
  bumpRecordingMessageCountByLiveToken,
  getRecordingForLiveCandidate,
} from "@/lib/recordings";

const BASE = (process.env.INTERVIEW_BRAIN_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type Body = {
  recordingId?: string;
  liveBumpToken?: string;
  liveSessionId?: string;
  /** From URL when there is no host recording row */
  interviewMode?: string;
};

function brainModeForRecordingType(type: "behavioral" | "technical"): "behavioral" | "full" {
  return type === "behavioral" ? "behavioral" : "full";
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const liveSessionId = typeof body.liveSessionId === "string" ? body.liveSessionId.trim() : "";
  const recordingId = typeof body.recordingId === "string" ? body.recordingId.trim() : "";
  const liveBumpToken = typeof body.liveBumpToken === "string" ? body.liveBumpToken.trim() : "";

  let knowledge: string;
  let mode: "behavioral" | "full";

  if (recordingId && liveBumpToken) {
    const rec = await getRecordingForLiveCandidate(recordingId, liveBumpToken);
    if (!rec) {
      return NextResponse.json({ error: "Invalid recording or token" }, { status: 403 });
    }
    if (rec.liveSessionId && liveSessionId && rec.liveSessionId !== liveSessionId) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }
    knowledge = buildInterviewKnowledge({
      jobTitle: rec.roleTitle ?? "",
      company: "",
      jobDescription: rec.jobDescriptionSnippet ?? "",
      resumeText: "",
      sessionNote: [
        "TrueFace verified company LIVE HIRING interview (monitored)—not practice. Interviewer name: Karen.",
        rec.candidateDisplayName ? `Candidate: ${rec.candidateDisplayName}.` : "",
        "You are Karen, the hiring manager. Real interview tone only—no mock or coaching framing.",
        LIVE_INTERVIEW_QUESTION_FOCUS,
      ].join(" "),
    });
    mode = brainModeForRecordingType(rec.type);
    await bumpRecordingMessageCountByLiveToken(recordingId, liveBumpToken, 2);
  } else {
    const urlMode = body.interviewMode === "technical" ? "technical" : "behavioral";
    mode = urlMode === "behavioral" ? "behavioral" : "full";
    knowledge = buildInterviewKnowledge({
      jobTitle: "",
      company: "",
      jobDescription: "",
      resumeText: "",
      sessionNote: `TrueFace verified LIVE HIRING interview (no job package on link)—not practice. Interviewer: Karen. Mode: ${urlMode}. Session: ${liveSessionId || "unknown"}. ${LIVE_INTERVIEW_QUESTION_FOCUS}`,
    });
  }

  try {
    const res = await fetch(`${BASE}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledge, mode, session_context: "live_hiring" }),
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
    const opening =
      typeof data.response === "string" ? data.response.trim() : "";
    if (recordingId && liveBumpToken && opening) {
      await appendLiveHiringTranscriptByToken(recordingId, liveBumpToken, [
        { role: "interviewer", text: opening },
      ]);
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("live-interview/brain/start:", e);
    return NextResponse.json(
      {
        error:
          "Could not reach the interview brain API. Start it with: uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000",
      },
      { status: 502 }
    );
  }
}
