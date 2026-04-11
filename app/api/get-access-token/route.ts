import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "LiveAvatar API key is missing" }, { status: 500 });
    }

    const res = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a",
        // 🚨 THE REAL FIX: No wrapper. An object directly at the root.
        avatar_persona: {
          prompt: "You are a Senior Engineering Manager conducting a technical mock interview."
        }
      }) 
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
        sessionId: data.data.session_id 
    });
    
  } catch (error) {
    console.error('Error fetching LiveAvatar token:', error);
    return NextResponse.json({ error: "Failed to generate access token" }, { status: 500 });
  }
}