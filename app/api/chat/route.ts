import type { Content } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import {
  generateWithVertexGemini,
  resolveGcpServiceAccountKeyPath,
} from "@/lib/gcp-vertex-gemini";
import { getSessionUser } from "@/lib/auth";
import { bumpRecordingMessageCount } from "@/lib/recordings";
import { resolveGeminiApiKey } from "@/lib/resolve-gemini-api-key";

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

function normalizeGeminiHistory(raw: unknown): Content[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (item && typeof item === "object" && "parts" in item && "role" in item) {
      return item as Content;
    }
    if (item && typeof item === "object" && "role" in item && "text" in item) {
      const o = item as { role: string; text: string };
      return {
        role: o.role === "user" ? "user" : "model",
        parts: [{ text: o.text }],
      };
    }
    return { role: "user", parts: [{ text: "" }] };
  });
}

export async function POST(req: Request) {
  const gcpKeyPath = resolveGcpServiceAccountKeyPath();

  try {
    const body = await req.json();
    const {
      message,
      history: rawHistory,
      recordingId,
      interviewType,
    } = body as {
      message: string;
      history?: unknown;
      recordingId?: string;
      interviewType?: string;
    };

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const history = normalizeGeminiHistory(rawHistory);
    const systemInstruction =
      interviewType === "behavioral" ? behavioralInstruction : technicalInstruction;

    let responseText: string;

    if (gcpKeyPath) {
      responseText = await generateWithVertexGemini(
        gcpKeyPath,
        message,
        history,
        systemInstruction
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
        systemInstruction,
      });
      const chat = model.startChat({
        history,
      });
      const result = await chat.sendMessage(message);
      responseText = result.response.text();
    }

    if (recordingId && typeof recordingId === "string") {
      const user = await getSessionUser();
      if (user) {
        await bumpRecordingMessageCount(recordingId, new ObjectId(user.id), 2);
      }
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
