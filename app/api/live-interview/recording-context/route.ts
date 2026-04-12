import { NextRequest, NextResponse } from "next/server";
import { buildInterviewKnowledge } from "@/lib/interview-context";
import { LIVE_INTERVIEW_QUESTION_FOCUS } from "@/lib/live-interview-focus";
import { getRecordingForLiveCandidate } from "@/lib/recordings";

/**
 * Public (token-gated) context for the candidate Live Interview page — drives LiveAvatar persona + interview brain.
 */
export async function GET(req: NextRequest) {
  const recordingId = req.nextUrl.searchParams.get("recordingId")?.trim() ?? "";
  const liveBumpToken = req.nextUrl.searchParams.get("t")?.trim() ?? "";
  const liveSessionId = req.nextUrl.searchParams.get("liveSessionId")?.trim() ?? "";

  if (!recordingId || !liveBumpToken) {
    return NextResponse.json({ error: "recordingId and t required" }, { status: 400 });
  }

  const rec = await getRecordingForLiveCandidate(recordingId, liveBumpToken);
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (rec.liveSessionId && liveSessionId && rec.liveSessionId !== liveSessionId) {
    return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
  }

  const knowledge = buildInterviewKnowledge({
    jobTitle: rec.roleTitle ?? "",
    company: "",
    jobDescription: rec.jobDescriptionSnippet ?? "",
    resumeText: "",
    sessionNote: [
      "TrueFace verified company LIVE HIRING interview (monitored)—not practice. Interviewer: Karen.",
      rec.candidateDisplayName ? `Candidate name (for tone): ${rec.candidateDisplayName}.` : "",
      rec.liveSessionId ? `Live session id: ${rec.liveSessionId}.` : "",
      LIVE_INTERVIEW_QUESTION_FOCUS,
    ]
      .filter(Boolean)
      .join(" "),
  });

  return NextResponse.json({
    knowledge,
    interviewType: rec.type,
    candidateDisplayName: rec.candidateDisplayName ?? null,
    roleTitle: rec.roleTitle ?? null,
  });
}
