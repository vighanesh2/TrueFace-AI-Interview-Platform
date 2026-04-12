"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import type { LiveavatarInterviewerGender } from "@/lib/liveavatar-interviewers";

const ML_ENGINE_URL = "http://localhost:8001";

interface Props {
  sessionId: string;
}

function LiveInterviewCandidateInner({ sessionId }: Props) {
  const searchParams = useSearchParams();
  const recordingId = searchParams.get("recording")?.trim() ?? "";
  const liveBumpToken = searchParams.get("t")?.trim() ?? "";
  const interviewType = searchParams.get("type") === "technical" ? "technical" : "behavioral";
  const interviewerGender: LiveavatarInterviewerGender =
    searchParams.get("interviewer")?.toLowerCase() === "female" ? "female" : "male";

  const candidateId = `candidate_${sessionId}`;
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mlConnected, setMlConnected] = useState(false);
  const [fillerCount, setFillerCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const avatarRef = useRef<LiveAvatarSession | null>(null);
  const [avatarStreamReady, setAvatarStreamReady] = useState(false);
  const [avatarStarting, setAvatarStarting] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function startAvatar() {
      setAvatarStarting(true);
      setAvatarFailed(false);
      setAvatarStreamReady(false);
      try {
        const tokenRes = await fetch("/api/get-access-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interviewer: interviewerGender,
            interviewMode: interviewType,
            profileContext:
              "Verified TrueFace live interview session. The candidate joined from the monitored candidate link.",
          }),
        });
        const tokenData = (await tokenRes.json()) as { token?: string };
        if (cancelled) return;
        if (!tokenRes.ok || !tokenData.token) {
          setAvatarFailed(true);
          return;
        }

        const avatar = new LiveAvatarSession(tokenData.token);
        if (cancelled) {
          void avatar.stop().catch(() => {});
          return;
        }

        avatarRef.current = avatar;

        avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
          if (cancelled) return;
          const video = document.getElementById(
            "candidate-liveavatar-video"
          ) as HTMLVideoElement | null;
          if (video) {
            avatar.attach(video);
            setAvatarStreamReady(true);
          }
        });

        avatar.on(SessionEvent.SESSION_DISCONNECTED, () => {
          if (!cancelled) setAvatarStreamReady(false);
        });

        await avatar.start();
      } catch {
        if (!cancelled) setAvatarFailed(true);
      } finally {
        if (!cancelled) setAvatarStarting(false);
      }
    }

    void startAvatar();

    return () => {
      cancelled = true;
      const a = avatarRef.current;
      avatarRef.current = null;
      if (a) void a.stop().catch(() => {});
      setAvatarStreamReady(false);
    };
  }, [interviewerGender, interviewType]);

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
        body: JSON.stringify({
          message: input,
          history: newMessages,
          interviewType,
          ...(recordingId && liveBumpToken ? { recordingId, liveBumpToken } : {}),
        }),
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
    <main className="dark flex min-h-screen flex-col bg-neutral-950 text-white">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex min-h-[calc(100dvh-1px)] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="mb-4 shrink-0 flex items-center justify-between gap-4 lg:mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100 sm:text-3xl">TrueFace Interview</h1>
            <p className="mt-0.5 text-sm text-neutral-500">This session is being verified by TrueFace</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
              mlConnected
                ? "bg-emerald-950/60 text-emerald-200/95 ring-emerald-400/25"
                : "bg-neutral-800/90 text-neutral-500 ring-white/5"
            }`}
          >
            {mlConnected ? "🛡️ Verified Session" : "Connecting…"}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          {/* Stage — mirrors LiveAvatarInterview meeting shell + video stack */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 shadow-sm dark:shadow-neutral-950/40 lg:min-h-[min(780px,calc(100dvh-9rem))]">
            <div className="relative flex min-h-[min(52vh,420px)] flex-1 flex-col bg-neutral-950 lg:min-h-0">
              <div className="absolute right-5 top-3 z-20 flex items-center gap-2 sm:right-6">
                {avatarStreamReady ? (
                  <span
                    className="rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm"
                    title="Interview mode for this session"
                  >
                    {interviewType === "behavioral" ? "Behavioral" : "Technical"}
                  </span>
                ) : null}
              </div>

              <video
                id="candidate-liveavatar-video"
                autoPlay
                playsInline
                className={
                  avatarStreamReady
                    ? "block min-h-0 w-full flex-1 bg-neutral-950 object-contain object-center"
                    : "hidden min-h-0 w-full flex-1"
                }
              />

              {!avatarStreamReady && (
                <div className="absolute inset-0 z-10 flex flex-col bg-neutral-950">
                  <div className="relative min-h-0 flex-1">
                    <Image
                      src={interviewerGender === "female" ? "/female.png" : "/male.png"}
                      alt={interviewerGender === "female" ? "Female interviewer preview" : "Male interviewer preview"}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 1024px) 100vw, min(70vw, 900px)"
                      priority
                    />
                    {avatarStarting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[2px]">
                        <span className="text-sm font-medium text-neutral-200">Connecting video…</span>
                      </div>
                    )}
                    {avatarFailed && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2.5 text-center text-xs leading-snug text-neutral-300">
                        Live avatar unavailable (check API key). Chat still works.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat — sidebar width similar to dashboard TrueFace column */}
          <div className="flex h-[min(420px,45vh)] w-full shrink-0 flex-col rounded-xl border border-neutral-700 bg-neutral-900 p-5 lg:h-auto lg:min-h-0 lg:w-96 lg:max-w-md">
            <div className="mb-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {messages.length === 0 && (
                <p className="mt-8 text-center text-sm text-neutral-500">
                  Your interviewer will greet you shortly. Type hello to begin.
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    msg.role === "user"
                      ? "self-end bg-cyan-900/90 text-white"
                      : "self-start bg-neutral-800 text-white"
                  }`}
                >
                  <span className="mb-1 block text-xs text-neutral-400">
                    {msg.role === "user" ? "You" : "Interviewer"}
                  </span>
                  {msg.text}
                </div>
              ))}
              {isLoading && <p className="animate-pulse text-sm text-neutral-500">Interviewer is typing…</p>}
            </div>

            <div className="mb-3 flex justify-between text-xs text-neutral-500">
              <span>
                Filler words:{" "}
                <span className={fillerCount > 5 ? "font-bold text-red-400" : "text-emerald-400"}>{fillerCount}</span>
              </span>
              <span>Exchanges: {Math.floor(messages.length / 2)}</span>
              <span className="text-neutral-600">Session: {sessionId.slice(-8)}</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your answer..."
                className="flex-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-cyan-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isLoading}
                className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <p className="mt-5 shrink-0 text-center text-xs text-neutral-600 lg:mt-6">
          🛡️ This interview is monitored by TrueFace AI for authenticity verification
        </p>
      </div>
    </main>
  );
}

export function LiveInterviewCandidate(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
          Loading session…
        </main>
      }
    >
      <LiveInterviewCandidateInner {...props} />
    </Suspense>
  );
}
