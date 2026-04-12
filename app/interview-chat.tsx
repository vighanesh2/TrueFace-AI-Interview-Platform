"use client";

import { Button, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { inputClass, labelClass, legendTitle, primaryButtonClass, subtleButtonClass } from "@/lib/fieldset-theme";
import type { InterviewType } from "@/lib/recordings";

const ML_ENGINE_URL = "http://localhost:8001";

type Props = {
  userEmail: string;
  recordingId: string;
  interviewType: InterviewType;
  recordingTitle: string;
};

const chatShell = clsx(
  "w-full max-w-2xl space-y-4 rounded-xl bg-white/5 p-6 sm:p-8",
  "border border-white/10 flex flex-col min-h-0"
);

const messageBubble = (role: string) =>
  clsx(
    "p-4 rounded-lg max-w-[85%] sm:max-w-[80%] text-sm/6",
    role === "user" ? "bg-gray-600/35 text-white self-end border border-white/10" : "bg-white/5 text-white/95 self-start border border-white/10"
  );

interface MLScores {
  final_score: number;
  risk_level: string;
  signal_breakdown: Record<string, { score: number; label: string }>;
}

export default function InterviewChat({ userEmail, recordingId, interviewType, recordingTitle }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [mlConnected, setMlConnected] = useState(false);
  const [mlScores, setMlScores] = useState<MLScores | null>(null);
  const [copied, setCopied] = useState(false);
  const [fillerCount, setFillerCount] = useState(0);
  const candidateId = useRef(`candidate_${recordingId}`);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<MediaStream | null>(null);

  const mlCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const res = await fetch(`${ML_ENGINE_URL}${endpoint}`, options);
      return await res.json();
    } catch { return null; }
  }, []);

  useEffect(() => {
    const init = async () => {
      const result = await mlCall(`/session/start?candidate_id=${candidateId.current}`, { method: "POST" });
      if (result) setMlConnected(true);
    };
    init();
  }, [mlCall]);

  useEffect(() => {
    const fetchScores = async () => {
      const report = await mlCall(`/session/report?candidate_id=${candidateId.current}&candidate_name=Candidate`, { method: "POST" });
      if (report?.final_score !== undefined) setMlScores(report);
    };
    fetchScores();
    const interval = setInterval(fetchScores, 5000);
    return () => clearInterval(interval);
  }, [mlCall]);

  useEffect(() => {
    const startCapture = async () => {
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
            const formData = new FormData();
            formData.append("file", blob, "frame.jpg");
            await mlCall(`/analyze/frame?candidate_id=${candidateId.current}`, { method: "POST", body: formData });
          }, "image/jpeg", 0.8);
        }, 3000);
      } catch {}
    };
    startCapture();
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (webcamRef.current) webcamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [mlCall]);

  const endSession = async () => {
    setEnding(true);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (webcamRef.current) webcamRef.current.getTracks().forEach(t => t.stop());
    try {
      await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      router.push("/dashboard/recordings");
      router.refresh();
    } finally { setEnding(false); }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history: newMessages, interviewType, recordingId }),
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.error) { console.error("Chat API:", data.error); return; }
      const updatedMessages = [...newMessages, { role: "ai", text: data.response }];
      setMessages(updatedMessages);
      await mlCall(`/record/response?response_text=${encodeURIComponent(input)}`, { method: "POST" });
      await mlCall(`/session/conversation?candidate_id=${candidateId.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: updatedMessages.map(m => ({ role: m.role === "user" ? "candidate" : "interviewer", text: m.text })) })
      });
    } catch (error) { console.error("Chat Error:", error);
    } finally { setIsLoading(false); }
  };

  const monitorUrl = `http://localhost:3000/monitor/${candidateId.current}`;
  const typeLabel = interviewType === "technical" ? "Technical" : "Behavioral";
  const getBarColor = (score: number) => score < 0.35 ? "bg-green-500" : score < 0.55 ? "bg-yellow-500" : "bg-red-500";
  const getRiskColor = (risk: string) => (risk === "AUTHENTIC" || risk === "LOW RISK") ? "text-green-400" : risk === "MEDIUM RISK" ? "text-yellow-400" : "text-red-400";

  return (
    <main className="dark flex min-h-screen bg-gray-950 p-6 font-sans text-white sm:p-8 gap-6">
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex flex-col items-center flex-1">
        <div className="w-full max-w-2xl flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="min-w-0 flex-1">
            <Link href="/dashboard/recordings" className="text-sm/6 font-medium text-white/55 hover:text-white underline-offset-2 hover:underline">← Recordings</Link>
            <p className="text-sm/6 text-white/50 truncate mt-1">{userEmail}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${mlConnected ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-500"}`}>{mlConnected ? "● ML LIVE" : "● ML OFFLINE"}</span>
            <Button type="button" onClick={() => void endSession()} disabled={ending} className={subtleButtonClass}>{ending ? "Saving…" : "End session"}</Button>
            <SignOutButton className={subtleButtonClass} />
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{typeLabel} session</p>
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight text-center max-w-2xl mt-1">{recordingTitle}</h1>
        <p className="text-sm/6 text-white/50 mb-8">Your AI interviewer is ready.</p>
        <Fieldset className={clsx(chatShell, "h-[min(520px,65vh)] mb-6")}>
          <Legend className={legendTitle}>Conversation</Legend>
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pr-1">
            {messages.length === 0 && <p className="text-sm/6 text-white/40 text-center mt-16">Type below to start your interview…</p>}
            {messages.map((msg, idx) => (
              <div key={idx} className={messageBubble(msg.role)}>
                <span className="font-semibold text-xs uppercase tracking-wide text-white/45 block mb-1.5">{msg.role === "user" ? "You" : "Interviewer"}</span>
                {msg.text}
              </div>
            ))}
            {isLoading && <p className="text-sm/6 text-white/40 self-start animate-pulse">Interviewer is typing…</p>}
          </div>
        </Fieldset>
        <Fieldset disabled={isLoading} className={clsx(chatShell, "space-y-5")}>
          <Legend className={legendTitle}>Your response</Legend>
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Filler words: <span className={fillerCount > 5 ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{fillerCount}</span></span>
            <span>Exchanges: {Math.floor(messages.length / 2)}</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field className="min-w-0 flex-1">
              <Label className={labelClass}>Message</Label>
              <Input type="text" name="message" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} placeholder="Type your answer…" className={inputClass} />
            </Field>
            <Button type="button" onClick={sendMessage} disabled={isLoading} className={clsx(primaryButtonClass, "mt-1 sm:mt-0 sm:w-auto sm:shrink-0 sm:px-8")}>Send</Button>
          </div>
        </Fieldset>
      </div>
      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div className="bg-gray-900 border border-cyan-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Company Monitor</h3>
          <p className="text-xs text-gray-400 mb-2">Share with interviewer:</p>
          <div className="text-xs text-cyan-300 font-mono break-all mb-2">{monitorUrl}</div>
          <button onClick={() => { navigator.clipboard.writeText(monitorUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="w-full text-xs bg-cyan-800 hover:bg-cyan-700 text-white px-3 py-1.5 rounded transition-colors">{copied ? "Copied!" : "Copy Link"}</button>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">TrueFace AI</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${mlConnected ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-500"}`}>{mlConnected ? "● LIVE" : "● OFFLINE"}</span>
          </div>
          {mlScores ? (
            <>
              <div className="text-center py-3 bg-gray-800 rounded-lg mb-3">
                <div className="text-4xl font-bold text-white">{Math.round((1 - mlScores.final_score) * 100)}%</div>
                <div className="text-xs text-gray-400 mt-1">Authenticity</div>
                <div className={`text-xs font-bold mt-1 ${getRiskColor(mlScores.risk_level)}`}>{mlScores.risk_level}</div>
              </div>
              <div className="flex flex-col gap-2">
                {Object.entries(mlScores.signal_breakdown).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-400 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-gray-500">{val.label}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all duration-700 ${getBarColor(val.score)}`} style={{ width: `${val.score * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-gray-500 text-xs">{mlConnected ? "Analyzing..." : "Start interview to begin"}</div>
          )}
        </div>
      </div>
    </main>
  );
}
