import { VertexAI } from "@google-cloud/vertexai";
import { NextResponse } from "next/server";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
const modelId = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function getModel() {
  if (!project) {
    throw new Error("GOOGLE_CLOUD_PROJECT is not set in .env.local");
  }
  const vertex = new VertexAI({ project, location });
  return vertex.getGenerativeModel({
    model: modelId,
    systemInstruction: {
      role: "system",
      parts: [
        {
          text: `You are a Senior Engineering Manager at a top tech company conducting a live interview.
The user is a college student applying for an internship.
Rules:
1. Ask exactly ONE question at a time. Do not overwhelm the candidate.
2. Keep your responses short (under 3 sentences) so the text-to-speech avatar sounds natural.
3. If the candidate struggles, offer a minor hint.
4. Never break character. You are the interviewer.`,
        },
      ],
    },
  });
}

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_APPLICATION_CREDENTIALS is not set. Point it to your Vertex service account JSON.",
        },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const model = getModel();
    const chat = model.startChat({
      history: history || [],
    });

    const result = await chat.sendMessage(message);
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const responseText = parts
      .filter((p): p is { text: string } => "text" in p && typeof p.text === "string")
      .map((p) => p.text)
      .join("");

    if (!responseText) {
      return NextResponse.json(
        { error: "Empty model response" },
        { status: 502 },
      );
    }

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Vertex Gemini error:", error);
    return NextResponse.json(
      { error: "Failed to generate interview response" },
      { status: 500 },
    );
  }
}
