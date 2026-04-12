"use client";

import { Button } from "@headlessui/react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { lightPrimaryButton } from "@/lib/dashboard-light-theme";
import type { LiveavatarInterviewerGender } from "@/lib/liveavatar-interviewers";
import { BodyLanguagePipHud, useBodyLanguageAnalysis } from "@/components/body-language-tracker";

const PIP_WIDTH_MIN = 120;
const PIP_WIDTH_MAX = 480;
const PIP_WIDTH_STORAGE = "trueface-pip-width";

function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

async function requestElFullscreen(el: HTMLElement): Promise<void> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    mozRequestFullScreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  if (anyEl.webkitRequestFullscreen) {
    anyEl.webkitRequestFullscreen();
    return;
  }
  if (anyEl.mozRequestFullScreen) {
    anyEl.mozRequestFullScreen();
    return;
  }
  if (anyEl.msRequestFullscreen) {
    anyEl.msRequestFullscreen();
    return;
  }
  throw new Error("Fullscreen not supported");
}

async function exitDocumentFullscreen(): Promise<void> {
  const d = document as Document & {
    webkitExitFullscreen?: () => void;
    mozCancelFullScreen?: () => void;
    msExitFullscreen?: () => void;
  };
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (d.webkitExitFullscreen) {
    d.webkitExitFullscreen();
    return;
  }
  if (d.mozCancelFullScreen) {
    d.mozCancelFullScreen();
    return;
  }
  if (d.msExitFullscreen) {
    d.msExitFullscreen();
  }
}

function IconMicOn({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 01-14 0M12 18v3M8 21h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMicOff({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 2l20 20M16 11a4 4 0 00-6.3-3.3M12 14a3 3 0 01-3-3V5m6 9v1a3 3 0 01-3 3M8 21h8M12 18v3M5 11h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconVideoOn({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconVideoOff({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 2l20 20M7 7H5a2 2 0 00-2 2v6a2 2 0 002 2h6M15.5 7.5L21 5v14M17 17H5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFullscreenEnter({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M3 15v4a2 2 0 002 2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFullscreenExit({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8V4h4M4 4l5 5M20 16v4h-4m4 0l-5-5M4 16l5 5M20 8l-5-5M16 4h4v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ZoomControlButton({
  active,
  danger,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors",
        disabled && "cursor-not-allowed opacity-40",
        danger &&
          "border-red-600/90 bg-red-600 text-white hover:bg-red-500 disabled:opacity-50",
        !danger &&
          !active &&
          "border-white/15 bg-neutral-800/90 text-white hover:bg-neutral-700",
        !danger &&
          active &&
          "border-white/25 bg-white text-neutral-900 hover:bg-neutral-100"
      )}
    >
      {children}
    </button>
  );
}

export function LiveAvatarInterview() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  /** Latest interviewer line — shown as video subtitles */
  const [interviewerSubtitle, setInterviewerSubtitle] = useState("");
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [interviewerGender, setInterviewerGender] = useState<LiveavatarInterviewerGender>("male");
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null);
  const avatarRef = useRef<LiveAvatarSession | null>(null);
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const pipResizeDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const answerInputRef = useRef<HTMLInputElement | null>(null);

  const [pipWidth, setPipWidthState] = useState(200);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIP_WIDTH_STORAGE);
      if (raw) {
        const n = Number.parseInt(raw, 10);
        if (!Number.isNaN(n)) {
          setPipWidthState(Math.min(PIP_WIDTH_MAX, Math.max(PIP_WIDTH_MIN, n)));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistPipWidth = useCallback((w: number) => {
    const clamped = Math.min(PIP_WIDTH_MAX, Math.max(PIP_WIDTH_MIN, Math.round(w)));
    setPipWidthState(clamped);
    try {
      localStorage.setItem(PIP_WIDTH_STORAGE, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const bodyLanguage = useBodyLanguageAnalysis(userVideoRef, sessionActive && cameraOn);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { [0]: { transcript: string } } } }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        stop: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { [0]: { transcript: string } } } }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        stop: () => void;
        start: () => void;
      };
    };
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i]![0]!.transcript;
        }
        setInput(currentTranscript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (isListening) {
      r.stop();
      setIsListening(false);
    } else {
      setInput("");
      r.start();
      setIsListening(true);
    }
  };

  const stopUserCamera = useCallback(() => {
    const stream = userStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      userStreamRef.current = null;
    }
    const el = userVideoRef.current;
    if (el) {
      el.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      stopUserCamera();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      userStreamRef.current = stream;
      setCameraOn(true);
    } catch (e) {
      console.error("Camera error:", e);
      alert("Could not access camera. Check permissions and try again.");
    }
  }, [cameraOn, stopUserCamera]);

  const toggleStageFullscreen = useCallback(async () => {
    const shell = stageContainerRef.current;
    if (!shell) return;
    try {
      if (getFullscreenElement() === shell) {
        await exitDocumentFullscreen();
      } else {
        await requestElFullscreen(shell);
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const el = stageContainerRef.current;
      setIsStageFullscreen(el != null && getFullscreenElement() === el);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    const stream = userStreamRef.current;
    const el = userVideoRef.current;
    if (!stream || !el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [cameraOn]);

  const stopAvatarSession = async () => {
    const shell = stageContainerRef.current;
    if (shell && getFullscreenElement() === shell) {
      try {
        await exitDocumentFullscreen();
      } catch {
        /* ignore */
      }
    }

    if (avatarRef.current) {
      try {
        await avatarRef.current.stop();
      } catch (e) {
        console.error("Error stopping avatar:", e);
      }
      avatarRef.current = null;
    }
    setSessionActive(false);
    setIsAvatarStarting(false);
    setIsChatting(false);
    setInterviewerSubtitle("");
    stopUserCamera();

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      setIsListening(false);
    }
  };

  const startAvatarSession = async () => {
    if (isAvatarStarting || sessionActive) return;

    setIsAvatarStarting(true);

    try {
      const tokenRes = await fetch("/api/get-access-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewer: interviewerGender }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.token) {
        console.error("Token request failed:", tokenData);
        alert(
          `Server error: ${tokenData.details?.message || tokenData.error || "Could not start avatar session."}`
        );
        throw new Error("Token generation failed");
      }

      const avatar = new LiveAvatarSession(tokenData.token);
      avatarRef.current = avatar;

      avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
        const videoElement = document.getElementById("avatar-video") as HTMLVideoElement | null;
        if (videoElement) {
          avatar.attach(videoElement);
          setSessionActive(true);
        }
      });

      avatar.on(SessionEvent.SESSION_DISCONNECTED, () => {
        void stopAvatarSession();
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

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      setIsListening(false);
    }

    const userText = input;
    setInput("");

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
        body: JSON.stringify({
          message: userText,
          history: formattedHistory,
          interviewType: "technical",
        }),
      });

      const chatData = await chatRes.json();

      if (!chatRes.ok || !chatData.response) {
        throw new Error(chatData.error || "Gemini did not respond");
      }

      const aiResponse = chatData.response as string;
      setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);
      setInterviewerSubtitle(aiResponse);

      if (avatarRef.current) {
        try {
          await avatarRef.current.repeat(aiResponse);
        } catch (sdkError) {
          console.error("Avatar repeat failed:", sdkError);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(messages);
      alert("Something went wrong. Wait a moment and try again.");
    } finally {
      setIsChatting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (avatarRef.current) {
        void avatarRef.current.stop().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      const stream = userStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        userStreamRef.current = null;
      }
    };
  }, []);

  const meetingShell = clsx(
    "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 shadow-sm",
    "dark:border-neutral-700 dark:shadow-neutral-950/40 lg:min-h-[min(780px,calc(100dvh-9rem))]",
    isStageFullscreen &&
      "h-screen max-h-screen w-screen max-w-none rounded-none border-0 shadow-none lg:min-h-0"
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 shrink-0 lg:mb-5">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
          Technical mock interview
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Turn on your camera for a draggable self-view with a light motion readout (same feed as the analysis). Use mic and
          the bar at the bottom to reply; interviewer lines show as captions.
        </p>
      </div>

      <div ref={stageContainerRef} className={meetingShell}>
        {/* Main stage — avatar / video */}
        <div
          className={clsx(
            "relative flex min-h-[min(52vh,420px)] flex-1 flex-col bg-neutral-950 lg:min-h-0",
            isStageFullscreen && "min-h-0 h-full"
          )}
        >
          {!sessionActive && (
            <button
              type="button"
              onClick={() => void toggleStageFullscreen()}
              className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-neutral-900/85 text-white shadow-lg backdrop-blur-sm hover:bg-neutral-800"
              title={isStageFullscreen ? "Exit full screen" : "Full screen"}
              aria-label={isStageFullscreen ? "Exit full screen" : "Enter full screen"}
            >
              {isStageFullscreen ? <IconFullscreenExit /> : <IconFullscreenEnter />}
            </button>
          )}

          <video
            id="avatar-video"
            autoPlay
            playsInline
            className={clsx(
              "min-h-0 w-full flex-1 object-contain object-center",
              sessionActive ? "block" : "hidden"
            )}
          >
            <track kind="captions" />
          </video>

          {!sessionActive && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-neutral-950 px-4 text-center">
              <div className="max-w-md space-y-2">
                <p className="text-sm font-medium text-neutral-200">Choose your interviewer</p>
                <p className="text-xs text-neutral-500">Then start the session. You can switch next time before joining.</p>
              </div>
              <fieldset className="flex w-full max-w-lg flex-col gap-3 sm:max-w-xl">
                <legend className="sr-only">Interviewer appearance</legend>
                <div className="grid grid-cols-2 gap-3 sm:gap-4" role="group" aria-label="Interviewer">
                  <button
                    type="button"
                    onClick={() => setInterviewerGender("male")}
                    aria-pressed={interviewerGender === "male"}
                    aria-label="Male interviewer"
                    className={clsx(
                      "flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
                      interviewerGender === "male"
                        ? "border-white shadow-lg shadow-white/10 ring-2 ring-white/40"
                        : "border-neutral-600 opacity-90 hover:border-neutral-400 hover:opacity-100"
                    )}
                  >
                    <div className="relative aspect-3/4 w-full bg-neutral-800">
                      <Image
                        src="/male.png"
                        alt="Male interviewer preview"
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 640px) 42vw, 200px"
                        priority
                      />
                    </div>
                    <span
                      className={clsx(
                        "px-2 py-2.5 text-center text-sm font-semibold sm:py-3",
                        interviewerGender === "male" ? "bg-white text-neutral-900" : "bg-neutral-900 text-neutral-200"
                      )}
                    >
                      Guy
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterviewerGender("female")}
                    aria-pressed={interviewerGender === "female"}
                    aria-label="Female interviewer"
                    className={clsx(
                      "flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
                      interviewerGender === "female"
                        ? "border-white shadow-lg shadow-white/10 ring-2 ring-white/40"
                        : "border-neutral-600 opacity-90 hover:border-neutral-400 hover:opacity-100"
                    )}
                  >
                    <div className="relative aspect-3/4 w-full bg-neutral-800">
                      <Image
                        src="/female.png"
                        alt="Female interviewer preview"
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 640px) 42vw, 200px"
                        priority
                      />
                    </div>
                    <span
                      className={clsx(
                        "px-2 py-2.5 text-center text-sm font-semibold sm:py-3",
                        interviewerGender === "female" ? "bg-white text-neutral-900" : "bg-neutral-900 text-neutral-200"
                      )}
                    >
                      Girl
                    </span>
                  </button>
                </div>
              </fieldset>
              <p className="text-sm text-neutral-400">Video off until you connect.</p>
              <Button
                type="button"
                onClick={() => void startAvatarSession()}
                disabled={isAvatarStarting}
                className={lightPrimaryButton}
              >
                {isAvatarStarting ? "Starting avatar…" : "Start interview"}
              </Button>
            </div>
          )}

          {sessionActive && cameraOn && (
            <div
              className="absolute bottom-28 right-4 z-20 overflow-hidden rounded-lg border-2 border-white/90 shadow-2xl sm:bottom-32"
              style={{ width: pipWidth }}
            >
              <div className="relative aspect-video w-full">
                <video
                  ref={userVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full -scale-x-100 object-cover"
                />
                <canvas ref={bodyLanguage.canvasRef} className="hidden" aria-hidden />
                <span className="absolute left-2 top-1.5 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                  You
                </span>
                <BodyLanguagePipHud motionScore={bodyLanguage.motionScore} warnings={bodyLanguage.warnings} />
                <div
                  role="slider"
                  aria-label="Resize your camera preview"
                  aria-valuemin={PIP_WIDTH_MIN}
                  aria-valuemax={PIP_WIDTH_MAX}
                  aria-valuenow={pipWidth}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (
                      e.key !== "ArrowLeft" &&
                      e.key !== "ArrowRight" &&
                      e.key !== "ArrowUp" &&
                      e.key !== "ArrowDown"
                    ) {
                      return;
                    }
                    e.preventDefault();
                    const step = e.shiftKey ? 24 : 12;
                    const delta =
                      e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : step;
                    setPipWidthState((prev) => {
                      const c = Math.min(PIP_WIDTH_MAX, Math.max(PIP_WIDTH_MIN, prev + delta));
                      try {
                        localStorage.setItem(PIP_WIDTH_STORAGE, String(c));
                      } catch {
                        /* ignore */
                      }
                      return c;
                    });
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pipResizeDragRef.current = { startX: e.clientX, startW: pipWidth };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!pipResizeDragRef.current) return;
                    const dx = e.clientX - pipResizeDragRef.current.startX;
                    persistPipWidth(pipResizeDragRef.current.startW + dx);
                  }}
                  onPointerUp={(e) => {
                    pipResizeDragRef.current = null;
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch {
                      /* ignore */
                    }
                  }}
                  onPointerCancel={(e) => {
                    pipResizeDragRef.current = null;
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="absolute bottom-0 right-0 z-30 flex h-5 w-5 cursor-nwse-resize touch-none items-end justify-end rounded-tl-md bg-white/35 p-0.5 hover:bg-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white drop-shadow" aria-hidden>
                    <path
                      d="M14 10l6-6M20 10V4h-6M4 20l6-6M10 20v-6H4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <span className="sr-only">Your camera preview with motion hints</span>
            </div>
          )}

          {sessionActive && input.trim() ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center bg-linear-to-b from-black/90 via-black/45 to-transparent px-4 pb-12 pt-3 sm:pb-14 sm:pt-4"
              role="status"
              aria-live="polite"
              aria-atomic="false"
            >
              <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-sky-300/95">
                You
              </span>
              <p className="max-h-40 max-w-4xl overflow-y-auto whitespace-pre-wrap break-words text-center text-base font-medium leading-snug tracking-wide text-sky-100 [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] sm:text-lg">
                {input}
              </p>
            </div>
          ) : null}

          {sessionActive && interviewerSubtitle ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-black/90 via-black/55 to-transparent px-4 pb-28 pt-20 sm:pb-32 sm:pt-24"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="sr-only">Interviewer</span>
              <p className="max-h-32 max-w-4xl overflow-y-auto text-center text-base font-medium leading-snug tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)] sm:text-lg">
                {interviewerSubtitle}
              </p>
            </div>
          ) : null}

          {/* Zoom-style meeting controls */}
          {sessionActive && (
            <div className="absolute bottom-4 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 px-2 sm:bottom-6 sm:w-auto sm:px-0">
              <div
                className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-neutral-900/95 px-3 py-3 shadow-2xl backdrop-blur-md sm:gap-3 sm:px-5"
                role="toolbar"
                aria-label="Meeting controls"
              >
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isChatting || !recognitionRef.current}
                  title={isListening ? "Mute" : "Unmute"}
                  aria-label={isListening ? "Mute microphone" : "Unmute microphone"}
                  className={clsx(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors",
                    (isChatting || !recognitionRef.current) && "cursor-not-allowed opacity-40",
                    isListening
                      ? "border-white/25 bg-white text-neutral-900 hover:bg-neutral-100"
                      : "border-red-500/55 bg-red-950/95 text-red-100 hover:bg-red-900/95"
                  )}
                >
                  {isListening ? <IconMicOn className="shrink-0" /> : <IconMicOff className="shrink-0" />}
                </button>

                <ZoomControlButton
                  active={cameraOn}
                  label={cameraOn ? "Stop video" : "Start video"}
                  onClick={() => void toggleCamera()}
                  disabled={isChatting}
                >
                  {cameraOn ? <IconVideoOn /> : <IconVideoOff />}
                </ZoomControlButton>

                <ZoomControlButton
                  active={isStageFullscreen}
                  label={isStageFullscreen ? "Exit full screen" : "Full screen"}
                  onClick={() => void toggleStageFullscreen()}
                >
                  {isStageFullscreen ? <IconFullscreenExit /> : <IconFullscreenEnter />}
                </ZoomControlButton>

                <div className="hidden h-8 w-px shrink-0 bg-white/15 sm:block" />

                <input
                  ref={answerInputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
                  disabled={isChatting}
                  tabIndex={-1}
                  className="sr-only"
                  aria-label="Your answer — shown as captions at the top; use the keyboard button or microphone"
                />

                <button
                  type="button"
                  onClick={() => answerInputRef.current?.focus()}
                  disabled={isChatting}
                  title="Type with keyboard (captions at top)"
                  aria-label="Type with keyboard"
                  className={clsx(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-neutral-800/90 text-white transition-colors hover:bg-neutral-700",
                    isChatting && "cursor-not-allowed opacity-40"
                  )}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 8h16v8H4V8zm2 2h2v2H6v-2zm3 0h2v2H9v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zm-9 3h8v2H6v-2z"
                      fill="currentColor"
                    />
                  </svg>
                </button>

                <Button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={isChatting}
                  className={clsx(
                    lightPrimaryButton,
                    "shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold"
                  )}
                >
                  {isChatting ? "Sending" : "Send"}
                </Button>

                <div className="hidden h-8 w-px shrink-0 bg-white/15 sm:block" />

                <ZoomControlButton
                  danger
                  label="Leave meeting"
                  onClick={() => void stopAvatarSession()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </ZoomControlButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
