"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentEventsEnum, LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import type { LiveavatarInterviewerGender } from "@/lib/liveavatar-interviewers";
import { buildInterviewKnowledge } from "@/lib/interview-context";
import { LIVE_INTERVIEW_QUESTION_FOCUS } from "@/lib/live-interview-focus";
import { ML_ENGINE_CLIENT_BASE, mlCandidateIdForLiveSession } from "@/lib/ml-engine";
import { ProctoringMonitor } from "@/lib/proctoring";

interface Props {
  sessionId: string;
}

/** Hands-free: pause this long after last speech before sending (ms). */
const SILENCE_BEFORE_SEND_MS = 2000;
/** After avatar audio ends, wait for room/speaker echo to decay before listening again (ms). */
const POST_AVATAR_LISTEN_COOLDOWN_MS = 1300;
/** Brief pause before avatar speaks so your last words and network turn settle (ms). */
const DELAY_BEFORE_AVATAR_REPEAT_MS = 700;
/** If HeyGen never sends speak_ended, resume STT after this much time from repeat() (bounded by utterance length). */
const STT_FALLBACK_MIN_MS = 5200;
const STT_FALLBACK_MAX_MS = 26000;

function estimateAvatarUtteranceMs(text: string): number {
  const t = text.trim();
  if (!t) return STT_FALLBACK_MIN_MS;
  const words = t.split(/\s+/).filter(Boolean).length;
  const ms = 2800 + words * 520;
  return Math.min(STT_FALLBACK_MAX_MS, Math.max(STT_FALLBACK_MIN_MS, ms));
}

function VerifiedBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
        active
          ? "bg-white/10 text-white ring-white/25"
          : "bg-neutral-800/90 text-neutral-500 ring-white/10"
      }`}
    >
      <svg
        className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-neutral-500"}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M12 3l7 4v5c0 5-3 9-7 11-4-2-7-6-7-11V7l7-4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {active ? "Verified session" : "Connecting…"}
    </span>
  );
}

function LiveInterviewCandidateInner({ sessionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlInterviewType = searchParams.get("type") === "technical" ? "technical" : "behavioral";
  const interviewerGender: LiveavatarInterviewerGender =
    searchParams.get("interviewer")?.toLowerCase() === "female" ? "female" : "male";
  const recordingId = searchParams.get("recording")?.trim() ?? "";
  const liveBumpToken = searchParams.get("t")?.trim() ?? "";

  const candidateId = mlCandidateIdForLiveSession(sessionId);
  const [mlConnected, setMlConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraOff, setCameraOff] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<MediaStream | null>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const avatarRef = useRef<LiveAvatarSession | null>(null);
  const brainSessionIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null);
  const micActiveIntentRef = useRef(false);
  const messagesRef = useRef<{ role: string; text: string }[]>([]);
  const brainBootstrappedRef = useRef(false);
  const dialogueReadyRef = useRef(false);
  const isChattingRef = useRef(false);
  const sttReadyRef = useRef(false);
  const submitUserAnswerRef = useRef<(text: string) => Promise<void>>(async () => {});
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef("");
  const prevCameraOffRef = useRef(false);
  const prevMicMutedRef = useRef(false);
  const leavingRef = useRef(false);
  const micMutedRef = useRef(false);
  const sttPausedForTypingRef = useRef(false);
  const sttSuppressedForAvatarRef = useRef(false);
  const resumeSttAfterAvatarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sttResumeFallbackTimerRef = useRef<number | null>(null);

  const [avatarStreamReady, setAvatarStreamReady] = useState(false);
  const [avatarStarting, setAvatarStarting] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [brainStarting, setBrainStarting] = useState(false);
  const [brainError, setBrainError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [interviewerSubtitle, setInterviewerSubtitle] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [dialogueReady, setDialogueReady] = useState(false);
  const [sttReady, setSttReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [liveSttPreview, setLiveSttPreview] = useState("");
  const [showTypedFallback, setShowTypedFallback] = useState(false);
  const [sttBlockedReason, setSttBlockedReason] = useState<"avatar" | "none">("none");

  messagesRef.current = messages;
  dialogueReadyRef.current = dialogueReady;
  isChattingRef.current = isChatting;
  sttReadyRef.current = sttReady;
  leavingRef.current = leaving;
  micMutedRef.current = micMuted;

  const mlCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const res = await fetch(`${ML_ENGINE_CLIENT_BASE}${endpoint}`, options);
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const syncConversationToMl = useCallback(
    async (turns: { role: string; text: string }[]) => {
      try {
        await fetch(`${ML_ENGINE_CLIENT_BASE}/session/conversation?candidate_id=${encodeURIComponent(candidateId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation: turns.map((m) => ({
              role: m.role === "user" ? "candidate" : "interviewer",
              text: m.text,
            })),
          }),
        });
      } catch {
        /* monitor transcript is best-effort */
      }
    },
    [candidateId]
  );

  useEffect(() => {
    const init = async () => {
      const result = await mlCall(`/session/start?candidate_id=${candidateId}`, { method: "POST" });
      if (result) setMlConnected(true);
    };
    void init();
  }, [mlCall, candidateId]);

  useEffect(() => {
    const monitor = new ProctoringMonitor((event) => {
      void fetch("/api/ml/proctoring-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, event }),
      });
    });
    monitor.start();
    return () => monitor.stop();
  }, [candidateId]);

  useEffect(() => {
    const v = selfVideoRef.current;
    if (v && localStream) {
      v.srcObject = localStream;
      void v.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    const start = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        webcamRef.current = stream;
        setLocalStream(stream);
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
              const fd = new FormData();
              fd.append("file", blob, "frame.jpg");
              await mlCall(`/analyze/frame?candidate_id=${candidateId}`, { method: "POST", body: fd });
            },
            "image/jpeg",
            0.8
          );
        }, 3000);
      } catch {
        setLocalStream(null);
      }
    };
    void start();
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (webcamRef.current) webcamRef.current.getTracks().forEach((t) => t.stop());
      webcamRef.current = null;
    };
  }, [mlCall, candidateId]);

  useEffect(() => {
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !cameraOff;
    });
  }, [cameraOff, localStream]);

  useEffect(() => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !micMuted;
    });
  }, [micMuted, localStream]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    type Rec = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((e: unknown) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      stop: () => void;
      start: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: new () => Rec;
      webkitSpeechRecognition?: new () => Rec;
    };
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: unknown) => {
      const ev = event as {
        results: { length: number; [i: number]: { 0: { transcript: string } } };
      };
      let full = "";
      for (let i = 0; i < ev.results.length; i++) {
        const item = ev.results[i]?.[0];
        if (item?.transcript) full += item.transcript;
      }
      pendingTranscriptRef.current = full;
      setLiveSttPreview(full);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (
        !micActiveIntentRef.current ||
        isChattingRef.current ||
        !dialogueReadyRef.current ||
        micMutedRef.current ||
        sttPausedForTypingRef.current ||
        sttSuppressedForAvatarRef.current
      )
        return;
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        const t = pendingTranscriptRef.current.trim();
        if (t.length < 2) return;
        void submitUserAnswerRef.current(t);
      }, SILENCE_BEFORE_SEND_MS);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micActiveIntentRef.current = false;
        setIsListening(false);
        setSttBlockedReason("none");
      }
    };
    recognition.onend = () => {
      if (micActiveIntentRef.current && recognitionRef.current) {
        queueMicrotask(() => {
          if (!micActiveIntentRef.current || !recognitionRef.current) return;
          try {
            recognitionRef.current.start();
          } catch {
            micActiveIntentRef.current = false;
            setIsListening(false);
          }
        });
      } else {
        setIsListening(false);
      }
    };
    recognitionRef.current = recognition;
    setSttReady(true);
    return () => {
      micActiveIntentRef.current = false;
      sttSuppressedForAvatarRef.current = false;
      if (resumeSttAfterAvatarTimerRef.current) {
        clearTimeout(resumeSttAfterAvatarTimerRef.current);
        resumeSttAfterAvatarTimerRef.current = null;
      }
      if (sttResumeFallbackTimerRef.current) {
        clearTimeout(sttResumeFallbackTimerRef.current);
        sttResumeFallbackTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setSttReady(false);
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const tryResumeCandidateListening = useCallback(() => {
    if (
      leavingRef.current ||
      !dialogueReadyRef.current ||
      !sttReadyRef.current ||
      micMutedRef.current ||
      sttPausedForTypingRef.current ||
      isChattingRef.current
    )
      return;
    const r = recognitionRef.current;
    if (!r) return;
    sttSuppressedForAvatarRef.current = false;
    setSttBlockedReason("none");
    if (micActiveIntentRef.current) return;
    window.setTimeout(() => {
      if (
        leavingRef.current ||
        !dialogueReadyRef.current ||
        !sttReadyRef.current ||
        micMutedRef.current ||
        sttPausedForTypingRef.current ||
        isChattingRef.current
      )
        return;
      const rec = recognitionRef.current;
      if (!rec || micActiveIntentRef.current) return;
      micActiveIntentRef.current = true;
      try {
        rec.start();
        setIsListening(true);
      } catch {
        micActiveIntentRef.current = false;
        setIsListening(false);
      }
    }, 160);
  }, []);

  const scheduleSttResumeFallback = useCallback((delayMs: number) => {
    if (sttResumeFallbackTimerRef.current) {
      clearTimeout(sttResumeFallbackTimerRef.current);
      sttResumeFallbackTimerRef.current = null;
    }
    sttResumeFallbackTimerRef.current = window.setTimeout(() => {
      sttResumeFallbackTimerRef.current = null;
      tryResumeCandidateListening();
    }, delayMs);
  }, [tryResumeCandidateListening]);

  const stopSpeechRecognitionUserIntent = useCallback(() => {
    micActiveIntentRef.current = false;
    if (sttResumeFallbackTimerRef.current) {
      clearTimeout(sttResumeFallbackTimerRef.current);
      sttResumeFallbackTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
    setLiveSttPreview("");
  }, []);

  const resumeListeningAfterTyping = useCallback(() => {
    sttPausedForTypingRef.current = false;
    if (sttSuppressedForAvatarRef.current) return;
    tryResumeCandidateListening();
  }, [tryResumeCandidateListening]);

  useEffect(() => {
    let cancelled = false;
    let onAvatarSpeakStart: (() => void) | undefined;
    let onAvatarSpeakEnd: (() => void) | undefined;

    async function startAvatar() {
      setAvatarStarting(true);
      setAvatarFailed(false);
      setAvatarStreamReady(false);
      setBrainError(null);
      brainSessionIdRef.current = null;
      brainBootstrappedRef.current = false;
      setDialogueReady(false);
      setMessages([]);
      setInterviewerSubtitle("");

      let profileContext = buildInterviewKnowledge({
        jobTitle: "",
        company: "",
        jobDescription: "",
        resumeText: "",
        sessionNote: `TrueFace verified LIVE HIRING interview (not practice). Interviewer: Karen. Mode: ${urlInterviewType}. ${LIVE_INTERVIEW_QUESTION_FOCUS}`,
      });
      let tokenInterviewMode: "behavioral" | "technical" = urlInterviewType;

      if (recordingId && liveBumpToken) {
        try {
          const q = new URLSearchParams({
            recordingId,
            t: liveBumpToken,
            liveSessionId: sessionId,
          });
          const ctxRes = await fetch(`/api/live-interview/recording-context?${q.toString()}`);
          if (ctxRes.ok) {
            const ctxJson = (await ctxRes.json()) as {
              knowledge?: string;
              interviewType?: string;
            };
            if (typeof ctxJson.knowledge === "string" && ctxJson.knowledge.trim()) {
              profileContext = ctxJson.knowledge;
            }
            if (ctxJson.interviewType === "technical" || ctxJson.interviewType === "behavioral") {
              tokenInterviewMode = ctxJson.interviewType;
            }
          }
        } catch {
          /* keep fallback context */
        }
      }

      if (cancelled) return;

      try {
        const tokenRes = await fetch("/api/get-access-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interviewer: interviewerGender,
            interviewMode: tokenInterviewMode,
            profileContext,
            liveHiring: true,
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

        const suppressSttForAvatarOutput = () => {
          sttSuppressedForAvatarRef.current = true;
          if (resumeSttAfterAvatarTimerRef.current) {
            clearTimeout(resumeSttAfterAvatarTimerRef.current);
            resumeSttAfterAvatarTimerRef.current = null;
          }
          if (sttResumeFallbackTimerRef.current) {
            clearTimeout(sttResumeFallbackTimerRef.current);
            sttResumeFallbackTimerRef.current = null;
          }
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          pendingTranscriptRef.current = "";
          if (!cancelled) {
            setLiveSttPreview("");
            setSttBlockedReason("avatar");
          }
          micActiveIntentRef.current = false;
          try {
            recognitionRef.current?.stop();
          } catch {
            /* ignore */
          }
          if (!cancelled) setIsListening(false);
        };

        const scheduleListenAfterAvatarFinishes = () => {
          if (resumeSttAfterAvatarTimerRef.current) {
            clearTimeout(resumeSttAfterAvatarTimerRef.current);
          }
          resumeSttAfterAvatarTimerRef.current = setTimeout(() => {
            resumeSttAfterAvatarTimerRef.current = null;
            if (cancelled) return;
            tryResumeCandidateListening();
          }, POST_AVATAR_LISTEN_COOLDOWN_MS);
        };

        onAvatarSpeakStart = () => {
          suppressSttForAvatarOutput();
        };
        onAvatarSpeakEnd = () => {
          scheduleListenAfterAvatarFinishes();
        };

        avatar.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onAvatarSpeakStart);
        avatar.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, onAvatarSpeakEnd);

        avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
          if (cancelled) return;
          const video = document.getElementById("candidate-liveavatar-video") as HTMLVideoElement | null;
          if (video) {
            avatar.attach(video);
            setAvatarStreamReady(true);
          }

          if (brainBootstrappedRef.current) return;
          brainBootstrappedRef.current = true;

          void (async () => {
            setBrainStarting(true);
            try {
              const startRes = await fetch("/api/live-interview/brain/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recordingId: recordingId || undefined,
                  liveBumpToken: liveBumpToken || undefined,
                  liveSessionId: sessionId,
                  interviewMode: urlInterviewType,
                }),
              });
              const data = (await startRes.json()) as {
                session_id?: string;
                response?: string;
                error?: string;
              };
              if (cancelled) return;
              if (!startRes.ok || !data.session_id || typeof data.response !== "string") {
                brainBootstrappedRef.current = false;
                setBrainError(
                  data.error ||
                    "Interview dialogue could not start. Ensure the interview API is running (port 8000)."
                );
                return;
              }
              brainSessionIdRef.current = data.session_id;
              const opening = data.response.trim();
              setMessages(opening ? [{ role: "ai", text: opening }] : []);
              setInterviewerSubtitle(opening);
              suppressSttForAvatarOutput();
              setDialogueReady(true);
              if (opening) {
                try {
                  await new Promise((r) => window.setTimeout(r, DELAY_BEFORE_AVATAR_REPEAT_MS));
                  if (cancelled) return;
                  await avatarRef.current?.repeat(opening);
                  scheduleSttResumeFallback(estimateAvatarUtteranceMs(opening));
                } catch (e) {
                  console.error("Avatar repeat:", e);
                  sttSuppressedForAvatarRef.current = false;
                  scheduleListenAfterAvatarFinishes();
                }
                void syncConversationToMl([{ role: "ai", text: opening }]);
              } else {
                sttSuppressedForAvatarRef.current = false;
                scheduleListenAfterAvatarFinishes();
              }
            } finally {
              if (!cancelled) setBrainStarting(false);
            }
          })();
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
      if (resumeSttAfterAvatarTimerRef.current) {
        clearTimeout(resumeSttAfterAvatarTimerRef.current);
        resumeSttAfterAvatarTimerRef.current = null;
      }
      if (sttResumeFallbackTimerRef.current) {
        clearTimeout(sttResumeFallbackTimerRef.current);
        sttResumeFallbackTimerRef.current = null;
      }
      sttSuppressedForAvatarRef.current = false;
      const a = avatarRef.current;
      avatarRef.current = null;
      brainSessionIdRef.current = null;
      if (a) {
        try {
          if (onAvatarSpeakStart) a.off(AgentEventsEnum.AVATAR_SPEAK_STARTED, onAvatarSpeakStart);
          if (onAvatarSpeakEnd) a.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, onAvatarSpeakEnd);
        } catch {
          /* ignore */
        }
        void a.stop().catch(() => {});
      }
      setAvatarStreamReady(false);
    };
  }, [
    interviewerGender,
    urlInterviewType,
    sessionId,
    recordingId,
    liveBumpToken,
    syncConversationToMl,
    tryResumeCandidateListening,
    scheduleSttResumeFallback,
  ]);

  const submitUserAnswer = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || isChatting) return;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopSpeechRecognitionUserIntent();
      pendingTranscriptRef.current = "";
      setInput("");
      setLiveSttPreview("");

      const sid = brainSessionIdRef.current;
      if (!sid || !dialogueReady) {
        setInput(trimmed);
        pendingTranscriptRef.current = trimmed;
        return;
      }

      const snapshot = messagesRef.current;
      const nextMessages = [...snapshot, { role: "user", text: trimmed }];
      setMessages(nextMessages);
      setIsChatting(true);
      let resumeMicWithoutAvatar = false;
      try {
        const turnRes = await fetch("/api/live-interview/brain/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brainSessionId: sid,
            answer: trimmed,
            recordingId: recordingId || undefined,
            liveBumpToken: liveBumpToken || undefined,
            liveSessionId: sessionId,
          }),
        });
        const turnData = (await turnRes.json()) as { response?: string; error?: string; interview_done?: boolean };
        if (!turnRes.ok || typeof turnData.response !== "string") {
          setMessages(snapshot);
          setInput(trimmed);
          setBrainError(turnData.error || "No response from interviewer.");
          resumeMicWithoutAvatar = true;
          return;
        }
        const aiText = turnData.response;
        const withAi = [...nextMessages, { role: "ai", text: aiText }];
        setMessages(withAi);
        setInterviewerSubtitle(aiText);
        if (aiText.trim()) {
          try {
            await new Promise((r) => window.setTimeout(r, DELAY_BEFORE_AVATAR_REPEAT_MS));
            await avatarRef.current?.repeat(aiText);
            scheduleSttResumeFallback(estimateAvatarUtteranceMs(aiText));
          } catch (e) {
            console.error("Avatar repeat:", e);
            sttSuppressedForAvatarRef.current = false;
            resumeMicWithoutAvatar = true;
          }
          void syncConversationToMl(withAi);
        } else {
          resumeMicWithoutAvatar = true;
        }
      } catch {
        setMessages(snapshot);
        setInput(trimmed);
        resumeMicWithoutAvatar = true;
      } finally {
        setIsChatting(false);
      }
      if (resumeMicWithoutAvatar) {
        window.setTimeout(() => tryResumeCandidateListening(), 700);
      }
    },
    [
      isChatting,
      dialogueReady,
      recordingId,
      liveBumpToken,
      sessionId,
      stopSpeechRecognitionUserIntent,
      syncConversationToMl,
      tryResumeCandidateListening,
      scheduleSttResumeFallback,
    ]
  );

  useEffect(() => {
    submitUserAnswerRef.current = submitUserAnswer;
  }, [submitUserAnswer]);

  const sendTypedMessage = useCallback(() => void submitUserAnswer(input), [input, submitUserAnswer]);

  useEffect(() => {
    if (!dialogueReady || !sttReady || leaving || micMuted || sttPausedForTypingRef.current) return;
    if (sttSuppressedForAvatarRef.current) return;
    tryResumeCandidateListening();
  }, [dialogueReady, sttReady, leaving, micMuted, tryResumeCandidateListening]);

  useEffect(() => {
    if (!micMuted) return;
    stopSpeechRecognitionUserIntent();
  }, [micMuted, stopSpeechRecognitionUserIntent]);

  useEffect(() => {
    if (!dialogueReady || !avatarStreamReady) {
      prevCameraOffRef.current = cameraOff;
      return;
    }
    if (cameraOff && !prevCameraOffRef.current) {
      const line =
        "I notice your camera is off. When you can, please turn it back on so we can continue the interview properly.";
      void (async () => {
        try {
          await avatarRef.current?.repeat(line);
        } catch {
          /* ignore */
        }
      })();
    }
    prevCameraOffRef.current = cameraOff;
  }, [cameraOff, dialogueReady, avatarStreamReady]);

  useEffect(() => {
    if (!dialogueReady || !avatarStreamReady) {
      prevMicMutedRef.current = micMuted;
      return;
    }
    if (micMuted && !prevMicMutedRef.current) {
      const line =
        "I notice your microphone is muted. Please unmute when you are ready to respond so I can hear your answers.";
      void (async () => {
        try {
          await avatarRef.current?.repeat(line);
        } catch {
          /* ignore */
        }
      })();
    }
    prevMicMutedRef.current = micMuted;
  }, [micMuted, dialogueReady, avatarStreamReady]);

  const leaveMeeting = useCallback(async () => {
    stopSpeechRecognitionUserIntent();
    setSttBlockedReason("none");
    setLeaving(true);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    frameIntervalRef.current = null;
    if (webcamRef.current) {
      webcamRef.current.getTracks().forEach((t) => t.stop());
      webcamRef.current = null;
    }
    setLocalStream(null);
    const a = avatarRef.current;
    avatarRef.current = null;
    if (a) await a.stop().catch(() => {});
    router.push("/");
  }, [router, stopSpeechRecognitionUserIntent]);

  const toggleCamera = useCallback(() => {
    setCameraOff((o) => !o);
  }, []);

  const toggleMic = useCallback(() => {
    setMicMuted((m) => !m);
  }, []);

  return (
    <main className="dark flex min-h-screen flex-col bg-neutral-950 text-white">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex min-h-[calc(100dvh-1px)] flex-col px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3 lg:mb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-100 sm:text-2xl">Live Interview</h1>
          </div>
          <VerifiedBadge active={mlConnected} />
        </div>

        {/* Split meeting stage: you (left) · interviewer (right) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg ring-1 ring-white/5 lg:min-h-[min(720px,calc(100dvh-10rem))]">
          {/* 50/50: equal-height rows on mobile, equal-width columns on lg */}
          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] divide-y divide-neutral-800 lg:grid-cols-2 lg:grid-rows-1 lg:divide-x lg:divide-y-0">
            {/* Self — top on mobile, left on lg */}
            <div className="relative flex min-h-0 flex-col overflow-hidden bg-black">
              <div className="absolute left-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                You
              </div>
              {localStream ? (
                <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
                  <video
                    ref={selfVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 h-full w-full object-cover object-center ${
                      cameraOff ? "opacity-0" : "-scale-x-100 opacity-100"
                    }`}
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center bg-neutral-950 text-sm text-neutral-500">
                  Camera unavailable
                </div>
              )}
              {localStream && cameraOff ? (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
                  <p className="text-sm text-neutral-500">Camera is off</p>
                </div>
              ) : null}
            </div>

            {/* Interviewer — bottom on mobile, right on lg (same footprint as You) */}
            <div className="relative flex min-h-0 flex-col overflow-hidden bg-black">
              <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                  Interviewer
                </span>
                {avatarStreamReady ? (
                  <span className="rounded-md border border-white/15 bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/85">
                    {urlInterviewType === "behavioral" ? "Behavioral" : "Technical"}
                  </span>
                ) : null}
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
                <video
                  id="candidate-liveavatar-video"
                  autoPlay
                  playsInline
                  className={
                    avatarStreamReady
                      ? "absolute inset-0 h-full w-full object-cover object-center"
                      : "pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0"
                  }
                />

                {!avatarStreamReady && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
                    {avatarStarting && (
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-sky-500"
                          aria-hidden
                        />
                        <p className="text-sm text-neutral-400">Connecting to video…</p>
                      </div>
                    )}
                    {!avatarStarting && avatarFailed && (
                      <p className="max-w-xs px-4 text-center text-sm text-neutral-400">
                        Live interviewer video unavailable. Check the HeyGen API key, then refresh.
                      </p>
                    )}
                    {!avatarStarting && !avatarFailed ? (
                      <p className="text-sm text-neutral-500">Preparing session…</p>
                    ) : null}
                  </div>
                )}
                {avatarStreamReady && brainStarting ? (
                  <div className="pointer-events-none absolute inset-0 z-[15] flex items-end justify-center bg-gradient-to-t from-black/70 to-transparent pb-6">
                    <p className="text-xs font-medium text-neutral-300">Interviewer is joining the conversation…</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Voice-first: speak and pause to send; typing is optional fallback */}
          <div className="shrink-0 border-t border-neutral-800 bg-neutral-950 px-3 py-3 sm:px-4">
            {brainError ? (
              <p className="mb-2 text-center text-xs text-amber-400/95">{brainError}</p>
            ) : null}
            {localStream && !localStream.getAudioTracks().length && dialogueReady && sttReady ? (
              <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200/95">
                No microphone on this camera session — voice captions may not work. Allow the mic when prompted, or
                refresh and grant camera + microphone.
              </p>
            ) : null}
            <div className="mb-2 rounded-lg border border-neutral-800 bg-black/40 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Interviewer</p>
                {dialogueReady && sttReady ? (
                  <span
                    className={`text-[10px] font-medium ${isListening ? "text-sky-400" : "text-neutral-600"}`}
                  >
                    {micMuted
                      ? "Unmute to answer by voice"
                      : isListening
                        ? "● Speak your answer — pause ~2 seconds to send"
                        : sttBlockedReason === "avatar"
                          ? "○ Mic for captions resumes after Karen finishes speaking…"
                          : "Starting microphone…"}
                  </span>
                ) : dialogueReady ? (
                  <span className="text-[10px] font-medium text-amber-500/90">
                    Speech not supported in this browser — open typing below.
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-h-24 overflow-y-auto text-sm leading-snug text-neutral-100">
                {brainStarting
                  ? "…"
                  : interviewerSubtitle || "When you are connected, your interviewer will speak first."}
              </p>
            </div>

            {dialogueReady && sttReady && liveSttPreview.trim() ? (
              <p className="mb-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-sm text-sky-100/95">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">You (voice)</span>
                <span className="mt-1 block text-neutral-100">{liveSttPreview}</span>
              </p>
            ) : null}

            {!showTypedFallback ? (
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <p className="text-center text-xs text-neutral-500 sm:text-left">
                  No typing needed — after Karen finishes speaking, answer normally. Pause about two seconds when
                  you&apos;re done so we only capture you (headphones help). The mic mutes while she talks so her
                  voice isn&apos;t transcribed as yours.
                </p>
                <button
                  type="button"
                  onClick={() => setShowTypedFallback(true)}
                  className="shrink-0 text-xs font-medium text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline"
                >
                  Type answer instead
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500" htmlFor="live-interview-answer">
                      Typed answer
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        sttPausedForTypingRef.current = false;
                        setShowTypedFallback(false);
                        setInput("");
                        queueMicrotask(() => resumeListeningAfterTyping());
                      }}
                      className="text-[10px] font-medium text-neutral-500 hover:text-neutral-300"
                    >
                      Use voice only
                    </button>
                  </div>
                  <textarea
                    id="live-interview-answer"
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => {
                      sttPausedForTypingRef.current = true;
                      stopSpeechRecognitionUserIntent();
                    }}
                    onBlur={() => {
                      resumeListeningAfterTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!isChatting && dialogueReady) void sendTypedMessage();
                      }
                    }}
                    disabled={isChatting || !dialogueReady}
                    placeholder={
                      dialogueReady
                        ? "Enter to send, Shift+Enter for newline"
                        : "Wait for the interviewer to finish connecting…"
                    }
                    className="min-h-[44px] w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-600/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void sendTypedMessage()}
                  disabled={isChatting || !dialogueReady || !input.trim()}
                  className="shrink-0 rounded-full border border-neutral-600 bg-neutral-800 px-5 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 sm:mb-0.5"
                >
                  {isChatting ? "Sending…" : "Send"}
                </button>
              </div>
            )}

            {dialogueReady && !sttReady ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="sr-only" htmlFor="live-interview-answer-fallback">
                  Your answer
                </label>
                <textarea
                  id="live-interview-answer-fallback"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!isChatting && dialogueReady) void sendTypedMessage();
                    }
                  }}
                  disabled={isChatting || !dialogueReady}
                  placeholder="Type your answer — Enter to send, Shift+Enter for newline"
                  className="min-h-[44px] w-full flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-600/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void sendTypedMessage()}
                  disabled={isChatting || !dialogueReady || !input.trim()}
                  className="shrink-0 rounded-full border border-neutral-600 bg-neutral-800 px-5 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 sm:mb-0.5"
                >
                  {isChatting ? "Sending…" : "Send"}
                </button>
              </div>
            ) : null}

            {isChatting ? (
              <p className="mt-2 text-center text-[10px] text-neutral-500">Interviewer is responding…</p>
            ) : null}
          </div>

          {/* Meeting controls */}
          <div className="flex shrink-0 items-center justify-center gap-2 border-t border-neutral-800 bg-neutral-950/95 px-3 py-3 sm:gap-3 sm:px-4">
            <button
              type="button"
              onClick={toggleCamera}
              disabled={!localStream}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-neutral-800 text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              title={cameraOff ? "Turn camera on" : "Turn camera off"}
              aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
            >
              {cameraOff ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 8h4l2-2h4v12H6L4 16V8zM16 10l4-2v8l-4-2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M2 22L22 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 8h4l2-2h8v12H6L4 16V8zM16 10l4-2v8l-4-2v-4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={toggleMic}
              disabled={!localStream?.getAudioTracks().length}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-neutral-800 text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              title={micMuted ? "Unmute microphone" : "Mute microphone"}
              aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {micMuted ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 22h8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 22h8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => void leaveMeeting()}
              disabled={leaving}
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {leaving ? "Leaving…" : "Leave"}
            </button>
          </div>
        </div>

        <p className="mt-4 shrink-0 text-center text-[11px] text-neutral-600">
          This session is monitored for authenticity. Session ID: {sessionId.slice(-10)}
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
