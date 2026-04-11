import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize Gemini using the key from your .env.local file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  // DEBUGGING LINES:
  console.log("My API Key is exactly this long:", process.env.GEMINI_API_KEY?.length);
  console.log("Does it start with AIza?", process.env.GEMINI_API_KEY?.startsWith("AIza"));
  
  try {
    const body = await req.json();
    // We expect the frontend to send the latest message and the past conversation
    const { message, history } = body; 

    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `You are a Senior Engineering Manager at a top tech company conducting a live interview. 
        The user is a college student applying for an internship. 
        Rules:
        1. Ask exactly ONE question at a time. Do not overwhelm the candidate.
        2. Keep your responses short (under 3 sentences) so the text-to-speech avatar sounds natural.
        3. If the candidate struggles, offer a minor hint. 
        4. Never break character. You are the interviewer.`
    });

    // Start the chat with the history provided by the frontend
    const chat = model.startChat({
      history: history || [],
    });

    // Send the user's latest answer to the model
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({ response: responseText });
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "Failed to generate interview response" }, { status: 500 });
  }
}