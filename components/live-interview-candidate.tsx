"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const ML_ENGINE_URL = "http://localhost:8001";

interface Props {
  sessionId: string;
}

export function LiveInterviewCandidate({ sessionId }: Props) {
  const candidateId = `candidate_${sessionId}`;
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mlConnected, setMlConnected] = useState(false);
  const [fillerCount, setFillerCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const mlCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const res = await fetch(`${ML_ENGINE_URL}${endpoint}`, options);
      return await res.json();
    } catch { return null; }
  }, []);

  // Start ML session
  useEffect(() => {
    const init = async () => {
      const result = await mlCall(`/session/start?candidate_id=${candidateId}`, { method: "POST" });
      if (result) setMlConnected(true);
    };
    init();
  }, [mlCall, candidateId]);

  // Webcam frame capture
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamRef.current = stream;
        frameIntervalRef.current = setInterval(async () => {
          if (!canvasRef.current || !webcamRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const video = document.createElement("video");
          video.srcObject = webcamRef.current;
          await video.play();
          canvas.width = 320; canvas.height = 240;
          ctx.drawImage(video, 0, 0, 320, 240);
          video.pause();
          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const fd = new FormData();
            fd.append("file", blob, "frame.jpg");
            await mlCall(`/analyze/frame?candidate_id=${candidateId}`, { method: "POST", body: fd });
          }, "image/jpeg", 0.8);
        }, 3000);
      } catch {}
    };
    start();
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (webcamRef.current) webcamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [mlCall, candidateId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const fillers = input.match(/\b(um|uh|like|basically|literally)\b/gi);
    if (fillers) setFillerCount(prev => prev + fillers.length);

    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history: newMessages }),
      });
      const data = await res.json();
      if (data.error) return;
      const updated = [...newMessages, { role: "ai", text: data.response }];
      setMessages(updated);

      await mlCall(`/record/response?response_text=${encodeURIComponent(input)}`, { method: "POST" });
      await mlCall(`/session/conversation?candidate_id=${candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: updated.map(m => ({
            role: m.role === "user" ? "candidate" : "interviewer",
            text: m.text
          }))
        })
      });
    } catch {}
    finally { setIsLoading(false); }
  };

  return (
    <main className="dark flex min-h-screen flex-col items-center bg-gray-950 text-white p-6">
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">TrueFace Interview</h1>
          <p className="text-gray-400 text-sm">This session is being verified by TrueFace</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-bold ${mlConnected ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-500"}`}>
          {mlConnected ? "🛡️ Verified Session" : "Connecting..."}
        </span>
      </div>

      {/* Chat */}
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl p-6 h-[500px] flex flex-col mb-4">
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4">
          {messages.length === 0 && (
            <p className="text-gray-500 text-sm text-center mt-16">Your interviewer will greet you shortly. Type hello to begin.</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`p-3 rounded-lg max-w-[80%] text-sm ${msg.role === "user" ? "bg-cyan-900 text-white self-end" : "bg-gray-800 text-white self-start"}`}>
              <span className="text-xs text-gray-400 block mb-1">{msg.role === "user" ? "You" : "Interviewer"}</span>
              {msg.text}
            </div>
          ))}
          {isLoading && <p className="text-gray-500 text-sm animate-pulse">Interviewer is typing...</p>}
        </div>

        {/* Feedback bar */}
        <div className="flex justify-between text-xs text-gray-500 mb-3">
          <span>Filler words: <span className={fillerCount > 5 ? "text-red-400 font-bold" : "text-green-400"}>{fillerCount}</span></span>
          <span>Exchanges: {Math.floor(messages.length / 2)}</span>
          <span className="text-gray-600">Session: {sessionId.slice(-8)}</span>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Type your answer..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-600"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center">
        🛡️ This interview is monitored by TrueFace AI for authenticity verification
      </p>
    </main>
  );
}
