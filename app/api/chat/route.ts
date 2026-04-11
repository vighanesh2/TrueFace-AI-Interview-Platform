import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Content } from "@google-cloud/vertexai";
import { NextResponse } from "next/server";
import {
  generateWithVertexGemini,
  resolveGcpServiceAccountKeyPath,
} from "@/lib/gcp-vertex-gemini";
import { resolveGeminiApiKey } from "@/lib/resolve-gemini-api-key";

const SYSTEM_INSTRUCTION = `You are a Senior Engineering Manager at a top tech company conducting a live interview. 
The user is a college student applying for an internship. 
Rules:
1. Ask exactly ONE question at a time. Do not overwhelm the candidate.
2. Keep your responses short (under 3 sentences) so the text-to-speech avatar sounds natural.
3. If the candidate struggles, offer a minor hint. 
4. Never break character. You are the interviewer.`;

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
  // DEBUGGING LINES:
  console.log("My API Key is exactly this long:", process.env.GEMINI_API_KEY?.length);
  console.log("Does it start with AIza?", process.env.GEMINI_API_KEY?.startsWith("AIza"));
  
  const gcpKeyPath = resolveGcpServiceAccountKeyPath();

  try {
    const body = await req.json();
    const { message, history } = body as {
      message: string;
      history?: Content[];
    };

    let responseText: string;

    if (gcpKeyPath) {
      responseText = await generateWithVertexGemini(
        gcpKeyPath,
        message,
        history,
        SYSTEM_INSTRUCTION
      );
    } else {
      const apiKey = resolveGeminiApiKey();
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              "No Gemini credentials: add your GCP service account JSON as newface-493021-1ef8bc846b2c.json in the project root, or set GCP_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS, or set GEMINI_API_KEY (Google AI Studio).",
          },
          { status: 500 }
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: SYSTEM_INSTRUCTION,
      });
      const chat = model.startChat({
        history: history || [],
      });
      const result = await chat.sendMessage(message);
      responseText = result.response.text();
    }

    if (recordingId && typeof recordingId === "string") {
      await bumpRecordingMessageCount(recordingId, new ObjectId(user.id), 2);
    }

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Gemini API Error:", error);
    const details = error as {
      errorDetails?: Array<{ reason?: string }>;
      message?: string;
    };
    const invalidKey = details.errorDetails?.some(
      (d) => d.reason === "API_KEY_INVALID"
    );
    const errMsg =
      invalidKey || String(details.message ?? error).includes("API_KEY_INVALID")
        ? "Invalid Gemini API key. Create a key at https://aistudio.google.com/apikey and set GEMINI_API_KEY in .env.local. Or use a GCP service account JSON with Vertex (GCP_SERVICE_ACCOUNT_PATH)."
        : "Failed to generate interview response";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
