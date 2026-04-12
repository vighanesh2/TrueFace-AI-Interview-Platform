import { NextResponse } from "next/server";
import {
  LIVEAVATAR_INTERVIEWER_IDS,
  resolveInterviewerAvatarId,
} from "@/lib/liveavatar-interviewers";
import { LIVE_INTERVIEW_QUESTION_FOCUS } from "@/lib/live-interview-focus";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "LiveAvatar API key is missing" }, { status: 500 });
    }

    let interviewer: string | undefined;
    let interviewMode: string | undefined;
    let profileContext: string | undefined;
    let liveHiring = false;
    try {
      const body = (await req.json()) as {
        interviewer?: string;
        interviewMode?: string;
        /** Optional job + resume text; truncated server-side for API limits */
        profileContext?: string;
        /** Company TrueFace live candidate link — real interview tone, interviewer Karen */
        liveHiring?: boolean;
      };
      interviewer = body.interviewer;
      interviewMode = body.interviewMode;
      profileContext = body.profileContext;
      liveHiring = Boolean(body.liveHiring);
    } catch {
      /* empty body */
    }

    const avatarId =
      resolveInterviewerAvatarId(interviewer) ?? LIVEAVATAR_INTERVIEWER_IDS.male;

    const isBehavioral = interviewMode === "behavioral";

    const interviewTypeLine = isBehavioral
      ? "Session type: BEHAVIORAL mock interview—experience, collaboration, leadership, and judgment (STAR/CAR). This is not a coding or algorithms screen unless the product explicitly switches mode."
      : "Session type: TECHNICAL mock interview—algorithms, systems, debugging depth, and stack discussion. This is not a behavioral-only screen unless the product explicitly switches mode.";

    const behaviorLine =
      "If the candidate asks you to repeat or says something off-topic or unclear, respond naturally—restate or redirect—without empty thanks or pretending they answered when they have not.";

    let personaPrompt: string;
    if (liveHiring) {
      personaPrompt = isBehavioral
        ? `You are Karen, a hiring manager conducting a real interview for a technical role (TrueFace verified employer session). This is not practice, not coaching, and not a demo. Your name is Karen—introduce yourself naturally. Never say "mock," "practice session," or describe STAR coaching. Never use bracket placeholders like [Candidate Name]; use a real name only if clearly provided in context, otherwise greet without a name. ${behaviorLine} ${LIVE_INTERVIEW_QUESTION_FOCUS}`
        : `You are Karen, a hiring manager conducting a real technical hiring interview (TrueFace verified employer session). Not practice or training. Your name is Karen—introduce yourself naturally. Never say "mock" or "practice." Never use bracket placeholders for names. ${behaviorLine} ${LIVE_INTERVIEW_QUESTION_FOCUS}`;
    } else {
      personaPrompt = isBehavioral
        ? `You are a Senior Engineering Manager conducting a behavioral mock interview. ${interviewTypeLine} ${behaviorLine} ${LIVE_INTERVIEW_QUESTION_FOCUS}`
        : `You are a Senior Engineering Manager conducting a technical mock interview. ${interviewTypeLine} ${behaviorLine} ${LIVE_INTERVIEW_QUESTION_FOCUS}`;
    }

    const ctx =
      typeof profileContext === "string" && profileContext.trim().length > 0
        ? profileContext.trim().slice(0, 3200)
        : "";
    if (ctx) {
      personaPrompt += ` Candidate and role context (internal—anchor questions to the target role; when a job description is included, prefer skills and scenarios implied by it over generic interview prompts; do not read the JD aloud verbatim unless clarifying): ${ctx}`;
    }

    if (personaPrompt.length > 8000) {
      personaPrompt = personaPrompt.slice(0, 8000);
    }

    const res = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: avatarId,
        avatar_persona: {
          prompt: personaPrompt,
        },
      }),
    });

    const data = await res.json();

    if (data.code !== 1000 || !data.data?.session_token) {
      console.error("\n❌ HEYGEN TOKEN REJECTION DETAILS ❌");
      console.error(data);
      console.error("=====================================\n");
      return NextResponse.json({ error: "LiveAvatar rejected the request", details: data }, { status: 400 });
    }

    return NextResponse.json({
      token: data.data.session_token,
      sessionId: data.data.session_id,
    });
  } catch (error) {
    console.error("Error fetching LiveAvatar token:", error);
    return NextResponse.json({ error: "Failed to generate access token" }, { status: 500 });
  }
}
