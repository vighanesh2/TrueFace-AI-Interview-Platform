"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";

const ML_ENGINE_URL = "http://localhost:8000";

interface MLScores {
  final_score: number;
  risk_level: string;
  signal_breakdown: {
    deepfake_detection: { score: number; label: string };
    voice_authenticity: { score: number; label: string };
    reasoning_continuity: { score: number; label: string };
    response_latency: { score: number; label: string };
    speech_patterns: { score: number; label: string };
  };
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [fillerCount, setFillerCount] = useState(0);
  const [userVideoActive, setUserVideoActive] = useState(false);
  const [candidateId] = useState(`candidate_${Date.now()}`);
  const [mlScores, setMlScores] = useState<MLScores | null>(null);
  const [mlConnected, setMlConnected] = useState(false);

  const recognitionRef = useRef<any>(null);
  const avatarRef = useRef<any>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const interimFillerCountRef = useRef(0);
  const frameIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // ML Engine helper
  const mlCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const res = await fetch(`${ML_ENGINE_URL}${endpoint}`, options);
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const startMLSession = useCallback(async () => {
    const result = await mlCall(`/session/start?candidate_id=${candidateId}`, { method: "POST" });
    if (result) {
      setMlConnected(true);
      console.log("ML session started:", candidateId);
    }
  }, [candidateId, mlCall]);

  const captureAndAnalyzeFrame = useCallback(async () => {
    if (!webcamStreamRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const video = document.createElement("video");
    video.srcObject = webcamStreamRef.current;
    await video.play();
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);
    video.pause();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");
      await mlCall(`/analyze/frame?candidate_id=${candidateId}`, {
        method: "POST",
        body: formData,
      });
    }, "image/jpeg", 0.8);
  }, [candidateId, mlCall]);

  const fetchMLReport = useCallback(async () => {
    const report = await mlCall(
      `/session/report?candidate_id=${candidateId}&candidate_name=Candidate`,
      { method: "POST" }
    );
    if (report && report.final_score !== undefined) {
      setMlScores(report);
    }
  }, [candidateId, mlCall]);

  const updateMLTranscript = useCallback(async (currentMessages: { role: string; text: string }[]) => {
    const conversation = currentMessages.map((m) => ({
      role: m.role === "user" ? "candidate" : "interviewer",
      text: m.text,
    }));
    await mlCall(`/session/conversation?candidate_id=${candidateId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation }),
    });
  }, [candidateId, mlCall]);

  // Speech recognition + filler word tracker
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          let isFinalResult = false;
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
            if (event.results[i].isFinal) isFinalResult = true;
          }
          setInput(currentTranscript);

          const fillers = currentTranscript.match(/\b(um|uh|uhm|like|Ah|basically|literally)\b/gi);
          const currentFillerAmount = fillers ? fillers.length : 0;
          if (currentFillerAmount > interimFillerCountRef.current) {
            const difference = currentFillerAmount - interimFillerCountRef.current;
            setFillerCount((prev) => prev + difference);
            interimFillerCountRef.current = currentFillerAmount;
          }
          if (isFinalResult) interimFillerCountRef.current = 0;
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const startUserCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        setUserVideoActive(true);
      }
      // Also use this stream for ML frame analysis
      webcamStreamRef.current = stream;
      frameIntervalRef.current = setInterval(captureAndAnalyzeFrame, 2000);
    } catch (err) {
      console.error("Failed to access webcam:", err);
      alert("Please allow webcam access.");
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const stopAvatarSession = async () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (avatarRef.current) {
      try { await avatarRef.current.stop(); } catch {}
      avatarRef.current = null;
    }
    setSessionActive(false);
    setIsAvatarStarting(false);
    setIsChatting(false);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    await fetchMLReport();
  };

  const startAvatarSession = async () => {
    if (isAvatarStarting || sessionActive) return;
    setIsAvatarStarting(true);

    try {
      await startMLSession();

      const tokenRes = await fetch("/api/get-access-token", { method: "POST" });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.token) {
        alert(`Server Error: ${tokenData.details?.message || "Check terminal"}`);
        throw new Error("Token generation failed");
      }

      const avatar = new LiveAvatarSession(tokenData.token);
      avatarRef.current = avatar;

      avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
        const videoElement = document.getElementById("avatar-video") as HTMLVideoElement;
        if (videoElement) {
          avatar.attach(videoElement);
          setSessionActive(true);
        }
      });

      avatar.on(SessionEvent.SESSION_DISCONNECTED, () => {
        stopAvatarSession();
      });

      await avatar.start();
    } catch (error) {
      console.error("Failed to start avatar:", error);
      await stopAvatarSession();
    } finally {
      setIsAvatarStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isChatting) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userText = input;
    setInput("");

    await mlCall(`/record/question`, { method: "POST" });

    const currentMessages = [...messages, { role: "user", text: userText }];
    setMessages(currentMessages);
    setIsChatting(true);

    try {
      const formattedHistory = currentMessages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history: formattedHistory }),
      });

      const chatData = await chatRes.json();
      if (!chatRes.ok || !chatData.response) throw new Error(chatData.error);

      const aiResponse = chatData.response;
      const updatedMessages = [...currentMessages, { role: "ai", text: aiResponse }];
      setMessages(updatedMessages);

      await mlCall(`/record/response?response_text=${encodeURIComponent(userText)}`, { method: "POST" });
      await updateMLTranscript(updatedMessages);
      await fetchMLReport();

      if (avatarRef.current) {
        try { await avatarRef.current.repeat(aiResponse); } catch {}
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(messages);
      alert("The Brain is temporarily overloaded. Wait 5 seconds and try again.");
    } finally {
      setIsChatting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (avatarRef.current) avatarRef.current.stop().catch(console.error);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const getRiskColor = (riskLevel: string) => {
    if (riskLevel === "AUTHENTIC") return "text-green-400";
    if (riskLevel === "LOW RISK") return "text-green-300";
    if (riskLevel === "MEDIUM RISK") return "text-yellow-400";
    if (riskLevel === "HIGH RISK") return "text-red-500";
    return "text-gray-400";
  };

  const getBarColor = (score: number) => {
    if (score < 0.35) return "bg-green-500";
    if (score < 0.55) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-6 text-cyan-400">TrueFace — Live Interview</h1>

      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-7xl flex gap-6">
        {/* LEFT — Interview */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="w-full aspect-video bg-gray-900 border border-gray-800 rounded-xl overflow-hidden relative flex items-center justify-center shadow-2xl">
            <video
              id="avatar-video"
              autoPlay
              playsInline
              className={`w-full h-full object-cover scale-110 translate-y-4 ${sessionActive ? "block" : "hidden"}`}
            >
              <track kind="captions" />
            </video>

            {/* Live Metrics */}
            {sessionActive && (
              <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-sm border border-gray-700 p-3 rounded-lg z-20">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Live Metrics</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗣️</span>
                  <p className="text-sm text-white">
                    Filler Words:{" "}
                    <span className={fillerCount > 5 ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                      {fillerCount}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Picture in Picture */}
            <div className="absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl z-20">
              <button
                onClick={startUserCamera}
                className={`w-full h-full flex flex-col items-center justify-center bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-bold transition-colors ${userVideoActive ? "hidden" : "flex"}`}
              >
                <span className="text-xl mb-1">📷</span>
                Enable Camera
              </button>
              <video
                ref={userVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${userVideoActive ? "block" : "hidden"}`}
              />
            </div>

            {!sessionActive && (
              <div className="absolute z-10 flex flex-col items-center gap-4">
                <p className="text-gray-400">Video feed offline.</p>
                <button
                  onClick={startAvatarSession}
                  disabled={isAvatarStarting}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg shadow-cyan-900/50 disabled:opacity-50"
                >
                  {isAvatarStarting ? "Booting up Avatar..." : "Start Interview"}
                </button>
              </div>
            )}

            {sessionActive && (
              <button
                onClick={stopAvatarSession}
                className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-500 text-white text-sm font-bold py-2 px-4 rounded-lg backdrop-blur-sm z-20"
              >
                End Interview
              </button>
            )}
          </div>

          {/* Chat */}
          <div className="h-40 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-2 shadow-inner">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg max-w-[85%] ${msg.role === "user" ? "bg-cyan-900/50 border border-cyan-800 self-end" : "bg-gray-800 border border-gray-700 self-start"}`}
              >
                <span className="font-bold text-[10px] uppercase tracking-wider text-gray-400 block mb-1">
                  {msg.role === "user" ? "You" : "Interviewer"}
                </span>
                <span className="text-sm text-gray-100">{msg.text}</span>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-gray-600 text-sm italic text-center mt-4">
                Conversation history will appear here...
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleListening}
              disabled={!sessionActive || isChatting}
              className={`flex items-center justify-center px-5 rounded-lg transition-all duration-300 disabled:opacity-50 ${
                isListening ? "bg-red-600 hover:bg-red-500 animate-pulse shadow-lg shadow-red-900/50" : "bg-gray-800 border border-gray-700 hover:bg-gray-700"
              }`}
            >
              {isListening ? "🛑" : "🎙️"}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type or speak your answer here..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              disabled={!sessionActive || isChatting}
            />
            <button
              onClick={sendMessage}
              disabled={!sessionActive || isChatting || !input.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-lg transition-colors shadow-lg shadow-cyan-900/50 disabled:opacity-50"
            >
              {isChatting ? "Thinking..." : "Send"}
            </button>
          </div>
        </div>

        {/* RIGHT — TrueFace Authenticity Panel */}
        <div className="w-80 flex flex-col gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">TrueFace AI</h2>
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${mlConnected ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                {mlConnected ? "● LIVE" : "● OFFLINE"}
              </span>
            </div>

            {mlScores ? (
              <>
                {/* Main Score */}
                <div className="text-center py-4 bg-gray-800 rounded-xl">
                  <div className="text-5xl font-bold text-white mb-1">
                    {Math.round((1 - mlScores.final_score) * 100)}%
                  </div>
                  <div className="text-xs text-gray-400 mb-2">Authenticity Score</div>
                  <div className={`text-sm font-bold ${getRiskColor(mlScores.risk_level)}`}>
                    {mlScores.risk_level}
                  </div>
                </div>

                {/* Signal Breakdown */}
                <div className="flex flex-col gap-3">
                  {Object.entries(mlScores.signal_breakdown).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className={`font-bold ${val.label === "fake" || val.label === "suspicious" ? "text-red-400" : val.label === "real" || val.label === "authentic" ? "text-green-400" : "text-gray-400"}`}>
                          {val.label}
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-700 ${getBarColor(val.score)}`}
                          style={{ width: `${val.score * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🛡️</div>
                <div className="text-gray-500 text-sm">
                  {mlConnected
                    ? "Analyzing... answer a question to see scores"
                    : "Start interview to begin fraud detection"}
                </div>
              </div>
            )}
          </div>

          {/* Filler word summary */}
          {sessionActive && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Speech Analysis</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Filler Words</span>
                <span className={fillerCount > 5 ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                  {fillerCount} detected
                </span>
              </div>
            </div>
          )}

          {/* Session info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Session</h3>
            <div className="text-xs text-gray-500 flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Exchanges</span>
                <span className="text-gray-300">{Math.floor(messages.length / 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>ML Status</span>
                <span className={mlConnected ? "text-green-400" : "text-gray-500"}>
                  {mlConnected ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
