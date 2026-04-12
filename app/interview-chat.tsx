"use client";

import { Button, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { inputClass, labelClass, legendTitle, primaryButtonClass, subtleButtonClass } from "@/lib/fieldset-theme";
import type { InterviewType } from "@/lib/recordings";

const ML_ENGINE_URL = "http://localhost:8001";

type Props = {
  userEmail: string;
  recordingId: string;
  interviewType: InterviewType;
  recordingTitle: string;
  /** Public URL from Vercel Blob when a mock-interview video was saved for this recording */
  meetingVideoUrl: string | null;
};

const chatShell = clsx(
  "w-full max-w-2xl space-y-4 rounded-xl bg-white/5 p-6 sm:p-8",
  "border border-white/10 flex flex-col min-h-0"
);

const messageBubble = (role: string) =>
  clsx(
    "p-4 rounded-lg max-w-[85%] sm:max-w-[80%] text-sm/6",
    role === "user"
      ? "self-end border border-white/10 bg-gray-600/35 text-white"
      : "self-start border border-white/10 bg-white/5 text-white/95"
  );

interface MLScores {
  final_score: number;
  risk_level: string;
  signal_breakdown: Record<string, { score: number; label: string }>;
}

export default function InterviewChat({
  userEmail,
  recordingId,
  interviewType,
  recordingTitle,
  meetingVideoUrl: meetingVideoUrlProp,
}: Props) {
  const router = useRouter();
  const [meetingVideoUrl, setMeetingVideoUrl] = useState<string | null>(meetingVideoUrlProp);
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
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setMeetingVideoUrl(meetingVideoUrlProp);
  }, [meetingVideoUrlProp]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/recordings/${recordingId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { meetingVideoUrl?: string | null };
        if (typeof data.meetingVideoUrl === "string" && data.meetingVideoUrl.length > 0) {
          setMeetingVideoUrl(data.meetingVideoUrl);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  useEffect(() => {
    const init = async () => {
      const result = await mlCall(`/session/start?candidate_id=${candidateId.current}`, { method: "POST" });
      if (result) setMlConnected(true);
    };
    void init();
  }, [mlCall]);

  useEffect(() => {
    const fetchScores = async () => {
      const report = await mlCall(
        `/session/report?candidate_id=${candidateId.current}&candidate_name=Candidate`,
        { method: "POST" }
      );
      if (report?.final_score !== undefined) setMlScores(report);
    };
    void fetchScores();
    const interval = setInterval(() => void fetchScores(), 5000);
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
          canvas.width = 320;
          canvas.height = 240;
          ctx.drawImage(video, 0, 0, 320, 240);
          video.pause();
          canvas.toBlob(
            async (blob) => {
              if (!blob) return;
              const formData = new FormData();
              formData.append("file", blob, "frame.jpg");
              await mlCall(`/analyze/frame?candidate_id=${candidateId.current}`, { method: "POST", body: formData });
            },
            "image/jpeg",
            0.8
          );
        }, 3000);
      } catch {
        /* no camera */
      }
    };
    void startCapture();
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (webcamRef.current) webcamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [mlCall]);

  const endSession = async () => {
    setEnding(true);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (webcamRef.current) webcamRef.current.getTracks().forEach((t) => t.stop());
    try {
      await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      router.push("/dashboard/recordings");
      router.refresh();
    } finally {
      setEnding(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const fillers = input.match(/\b(um|uh|like|basically|literally)\b/gi);
    if (fillers) setFillerCount((prev) => prev + fillers.length);
    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    const sent = input;
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: sent,
          history: newMessages,
          interviewType,
          recordingId,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.error) {
        console.error("Chat API:", data.error);
        return;
      }
      const updatedMessages = [...newMessages, { role: "ai", text: data.response }];
      setMessages(updatedMessages);
      await mlCall(`/record/response?response_text=${encodeURIComponent(sent)}`, { method: "POST" });
      await mlCall(`/session/conversation?candidate_id=${candidateId.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: updatedMessages.map((m) => ({
            role: m.role === "user" ? "candidate" : "interviewer",
            text: m.text,
          })),
        }),
      });
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const monitorUrl = `http://localhost:3000/monitor/${candidateId.current}`;
  const typeLabel = interviewType === "technical" ? "Technical" : "Behavioral";
  const getBarColor = (score: number) =>
    score < 0.35 ? "bg-green-500" : score < 0.55 ? "bg-yellow-500" : "bg-red-500";
  const getRiskColor = (risk: string) =>
    risk === "AUTHENTIC" || risk === "LOW RISK"
      ? "text-green-400"
      : risk === "MEDIUM RISK"
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <main className="dark flex min-h-screen gap-6 bg-gray-950 p-6 font-sans text-white sm:p-8">
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex flex-1 flex-col items-center">
        <div className="mb-6 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href="/dashboard/recordings"
              className="text-sm/6 font-medium text-white/55 underline-offset-2 hover:text-white hover:underline"
            >
              ← Recordings
            </Link>
            <p className="mt-1 truncate text-sm/6 text-white/50" title={userEmail}>
              {userEmail}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs font-bold ${
                mlConnected ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-500"
              }`}
            >
              {mlConnected ? "● ML LIVE" : "● ML OFFLINE"}
            </span>
            <Button type="button" onClick={() => void endSession()} disabled={ending} className={subtleButtonClass}>
              {ending ? "Saving…" : "End session"}
            </Button>
            <SignOutButton className={subtleButtonClass} />
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{typeLabel} session</p>
        <h1 className="mt-1 max-w-2xl text-center text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {recordingTitle}
        </h1>
        <p className="mb-6 text-sm/6 text-white/50">Your AI interviewer is ready.</p>

        {meetingVideoUrl ? (
          <section
            className="mb-6 w-full max-w-2xl rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4 sm:p-5"
            aria-label="Saved meeting recording"
          >
            <h2 className="text-sm font-semibold text-white/95">Mock interview recording</h2>
            <p className="mt-1 text-xs text-white/45">Video from your live avatar session.</p>
            <video
              className="mt-4 max-h-[min(50vh,420px)] w-full rounded-lg border border-white/10 bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              src={meetingVideoUrl}
            >
              <track kind="captions" />
            </video>
            <p className="mt-3 text-xs text-white/40">
              <a
                href={meetingVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline"
              >
                Open in new tab
              </a>
              <span className="mx-2 text-white/25">·</span>
              WebM works best in Chrome or Edge; Safari may not play audio/video.
            </p>
          </section>
        ) : null}

        <Fieldset className={clsx(chatShell, "mb-6 h-[min(520px,65vh)]")}>
          <Legend className={legendTitle}>Conversation</Legend>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="mt-16 text-center text-sm/6 text-white/40">Type below to start your interview…</p>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={messageBubble(msg.role)}>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/45">
                  {msg.role === "user" ? "You" : "Interviewer"}
                </span>
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <p className="animate-pulse self-start text-sm/6 text-white/40">Interviewer is typing…</p>
            )}
          </div>
        </Fieldset>
        <Fieldset disabled={isLoading} className={clsx(chatShell, "space-y-5")}>
          <Legend className={legendTitle}>Your response</Legend>
          <div className="mb-1 flex justify-between text-xs text-white/40">
            <span>
              Filler words:{" "}
              <span className={fillerCount > 5 ? "font-bold text-red-400" : "font-bold text-green-400"}>
                {fillerCount}
              </span>
            </span>
            <span>Exchanges: {Math.floor(messages.length / 2)}</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field className="min-w-0 flex-1">
              <Label className={labelClass}>Message</Label>
              <Input
                type="text"
                name="message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void sendMessage()}
                placeholder="Type your answer…"
                className={inputClass}
              />
            </Field>
            <Button
              type="button"
              onClick={() => void sendMessage()}
              disabled={isLoading}
              className={clsx(primaryButtonClass, "mt-1 sm:mt-0 sm:w-auto sm:shrink-0 sm:px-8")}
            >
              Send
            </Button>
          </div>
        </Fieldset>
      </div>
      <div className="flex w-72 shrink-0 flex-col gap-4">
        <div className="rounded-xl border border-cyan-800 bg-gray-900 p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-400">Company Monitor</h3>
          <p className="mb-2 text-xs text-gray-400">Share with interviewer:</p>
          <div className="mb-2 break-all font-mono text-xs text-cyan-300">{monitorUrl}</div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(monitorUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="w-full rounded bg-cyan-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-cyan-700"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">TrueFace AI</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                mlConnected ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-500"
              }`}
            >
              {mlConnected ? "● LIVE" : "● OFFLINE"}
            </span>
          </div>
          {mlScores ? (
            <>
              <div className="mb-3 rounded-lg bg-gray-800 py-3 text-center">
                <div className="text-4xl font-bold text-white">{Math.round((1 - mlScores.final_score) * 100)}%</div>
                <div className="mt-1 text-xs text-gray-400">Authenticity</div>
                <div className={`mt-1 text-xs font-bold ${getRiskColor(mlScores.risk_level)}`}>
                  {mlScores.risk_level}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {Object.entries(mlScores.signal_breakdown).map(([key, val]) => (
                  <div key={key}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="capitalize text-gray-400">{key.replace(/_/g, " ")}</span>
                      <span className="text-gray-500">{val.label}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-800">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-700 ${getBarColor(val.score)}`}
                        style={{ width: `${val.score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-xs text-gray-500">
              {mlConnected ? "Analyzing…" : "Start interview to begin"}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
