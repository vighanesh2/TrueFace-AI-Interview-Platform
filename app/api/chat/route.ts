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

export async function POST(req: Request) {
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
