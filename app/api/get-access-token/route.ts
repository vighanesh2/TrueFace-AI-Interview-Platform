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
        // LITE = bring-your-own LLM (our FastAPI). Text-to-avatar must use LiveKit data
        // channel (see patchLiteModeTextOverLiveKit in app/page.tsx); WS text speak throws.
        mode: "LITE",
        avatar_id: "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a",
      })
    });

    const data = await res.json();

    // 🚨 DEBUGGING: You can actually delete these console logs now if you want, 
    // but leaving them is harmless.
    console.log("\n=== LIVEAVATAR RAW RESPONSE ===");
    console.log(data);
    console.log("===============================\n");

    // THE FIX: Check for code 1000 and data.session_token
    if (data.code !== 1000 || !data.data?.session_token) {
       return NextResponse.json({ error: "LiveAvatar rejected the request", details: data }, { status: 400 });
    }

    // THE FIX: Return the correct token path
    return NextResponse.json({ token: data.data.session_token });
    
  } catch (error) {
    console.error('Error fetching LiveAvatar token:', error);
    return NextResponse.json({ error: "Failed to generate access token" }, { status: 500 });
  }
}