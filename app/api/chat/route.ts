import { GoogleGenerativeAI } from "@google/generative-ai";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { bumpRecordingMessageCount, getRecordingForUser, type InterviewType } from "@/lib/recordings";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

type Turn = { role: string; text: string };

function toGeminiHistory(turns: Turn[] | undefined, latestUserText: string) {
  let list = [...(turns ?? [])];
  const last = list[list.length - 1];
  if (last?.role === "user" && last.text === latestUserText) {
    list = list.slice(0, -1);
  }
  return list.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.text }],
  }));
}

const technicalInstruction = `You are a Senior Engineering Manager at a top tech company conducting a live TECHNICAL interview.
The candidate is applying for an internship or early-career role.
Rules:
1. Ask exactly ONE technical question at a time (algorithms, systems, debugging mindset, or depth on their stack).
2. Use short follow-ups based on their last answer and how deep they go.
3. Keep each reply under 3 sentences so a voice avatar stays natural.
4. If they struggle, offer a small hint—not the full answer.
5. Never break character. You are the interviewer.`;

const behavioralInstruction = `You are a Senior Engineering Manager conducting a live BEHAVIORAL interview.
The candidate is applying for an internship or early-career role.
Rules:
1. Ask exactly ONE behavioral question at a time. Encourage STAR or CAR structure when helpful.
2. Use follow-ups to probe specifics, trade-offs, and ownership—mirror real hiring loops.
3. Keep each reply under 3 sentences.
4. If an answer is vague, ask one clarifying follow-up before moving on.
5. Never break character. You are the interviewer.`;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { message, history, interviewType, recordingId } = body as {
      message?: string;
      history?: Turn[];
      interviewType?: InterviewType;
      recordingId?: string;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    if (recordingId && typeof recordingId === "string") {
      const rec = await getRecordingForUser(recordingId, new ObjectId(user.id));
      if (!rec) {
        return NextResponse.json({ error: "Recording not found" }, { status: 404 });
      }
    }

    const systemInstruction = interviewType === "behavioral" ? behavioralInstruction : technicalInstruction;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
    });

    const chat = model.startChat({
      history: toGeminiHistory(history, message),
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    if (recordingId && typeof recordingId === "string") {
      await bumpRecordingMessageCount(recordingId, new ObjectId(user.id), 2);
    }

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "Failed to generate interview response" }, { status: 500 });
  }
}
