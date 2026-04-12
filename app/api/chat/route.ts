import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history } = body;

    const messages = [
      {
        role: "system" as const,
        content: `You are a Senior Engineering Manager conducting a live technical interview. Ask ONE question at a time. Keep responses under 3 sentences. Never break character.`
      },
      ...(history || []).map((h: any) => ({
        role: h.role === "model" || h.role === "ai" ? "assistant" as const : "user" as const,
        content: h.parts?.[0]?.text || h.text || ""
      })),
      { role: "user" as const, content: message }
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 150
    });

    return NextResponse.json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed to generate interview response" }, { status: 500 });
  }
}
