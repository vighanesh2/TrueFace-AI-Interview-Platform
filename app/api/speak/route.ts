import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const { sessionId, text } = await req.json();

    // The Hacker Move: Hit the main production HeyGen API, not the LiveAvatar beta domain
    const res = await fetch('https://api.heygen.com/v1/streaming.task', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey as string,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,
        text: text,
        task_type: "talk"
      })
    });

    const data = await res.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Backend Speech Error:", error);
    return NextResponse.json({ error: "Failed to send speech task" }, { status: 500 });
  }
}