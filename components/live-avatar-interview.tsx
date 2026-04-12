"use client";

import {
  Button,
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import { upload } from "@vercel/blob/client";
import clsx from "clsx";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { lightPrimaryButton } from "@/lib/dashboard-light-theme";
import { buildInterviewKnowledge } from "@/lib/interview-context";
import type { LiveavatarInterviewerGender } from "@/lib/liveavatar-interviewers";
import { BodyLanguagePipHud, useBodyLanguageAnalysis } from "@/components/body-language-tracker";

const PIP_WIDTH_MIN = 120;
const PIP_WIDTH_MAX = 480;
const PIP_WIDTH_STORAGE = "trueface-pip-width";

const prejoinFieldClass =
  "w-full rounded-lg border border-white/15 bg-neutral-900/90 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-white/35 focus:outline-none focus:ring-1 focus:ring-white/20";

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

<<<<<<< Updated upstream
function IconRecord({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="6" fill="currentColor" />
    </svg>
  );
}

function stopCompositeDraw(rafRef: { current: number | null }) {
  if (rafRef.current != null) {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }
}

type VideoWithCapture = HTMLVideoElement & {
  captureStream?: (frameRate?: number) => MediaStream;
};

/** Captures the avatar video (and optional PiP camera) for MediaRecorder. */
function buildMeetingRecordStream(
  avatarEl: HTMLVideoElement,
  userEl: HTMLVideoElement | null,
  includeCamera: boolean,
  rafRef: { current: number | null }
): MediaStream | null {
  const cap = (avatarEl as VideoWithCapture).captureStream;
  if (typeof cap !== "function") return null;
  const base = cap.call(avatarEl, 30);
  if (!includeCamera || !userEl) {
    return base;
  }

  const w = Math.max(avatarEl.videoWidth || 1280, 640);
  const h = Math.max(avatarEl.videoHeight || 720, 360);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return base;
  }

  const pipW = Math.round(w * 0.22);
  const pipH = Math.round(pipW * (9 / 16));
  const pad = 16;

  const draw = () => {
    if (avatarEl.readyState >= 2) {
      try {
        ctx.drawImage(avatarEl, 0, 0, w, h);
      } catch {
        /* skip frame */
      }
    }
    if (userEl.readyState >= 2) {
      try {
        ctx.drawImage(userEl, w - pipW - pad, h - pipH - pad, pipW, pipH);
      } catch {
        /* skip frame */
      }
    }
    rafRef.current = requestAnimationFrame(draw);
  };
  rafRef.current = requestAnimationFrame(draw);

  const canvasStream = canvas.captureStream(30);
  const vTrack = canvasStream.getVideoTracks()[0];
  const aTracks = base.getAudioTracks();
  return new MediaStream(vTrack ? [vTrack, ...aTracks] : [...canvasStream.getTracks(), ...aTracks]);
}

function pickRecorderMime(): string | undefined {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return undefined;
}

/** Vercel Blob allowlist matches top-level types only (no `;codecs=…` suffix). */
function blobUploadContentType(raw: string): string {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "video/webm" || base === "video/x-matroska") return base;
  return "video/webm";
}

=======
function pickMeetingRecorderMime(): string {
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

function triggerWebmDownload(blob: Blob, hintId: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trueface-mock-${hintId.slice(-10)}.webm`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

>>>>>>> Stashed changes
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const brainSessionIdRef = useRef<string | null>(null);
  const interviewContextRef = useRef("");

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [resumeLabel, setResumeLabel] = useState("");

  const [interviewMode, setInterviewModeState] = useState<"behavioral" | "technical">(() =>
    searchParams.get("mode") === "technical" ? "technical" : "behavioral"
  );

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
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
  /** True while the user wants dictation on; survives browser auto-`end` between phrases. */
  const micActiveIntentRef = useRef(false);
  const avatarRef = useRef<LiveAvatarSession | null>(null);
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const pipResizeDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const answerInputRef = useRef<HTMLInputElement | null>(null);

<<<<<<< Updated upstream
  const meetingComposeRafRef = useRef<number | null>(null);
  const meetingRecordStreamRef = useRef<MediaStream | null>(null);
  const meetingRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingChunksRef = useRef<Blob[]>([]);
  const meetingRecordingIdRef = useRef<string | null>(null);
  const meetingBlobPathRef = useRef<string | null>(null);
  const meetingStopUploadPromiseRef = useRef<Promise<void> | null>(null);

  const [meetingRecordState, setMeetingRecordState] = useState<"idle" | "recording" | "uploading">("idle");
=======
  const recordingIdRef = useRef<string | null>(null);
  const recordingSavedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordedMimeRef = useRef("");
  const recorderMicStreamRef = useRef<MediaStream | null>(null);
  const meetingRecorderStartedRef = useRef(false);

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [saveRecordingBusy, setSaveRecordingBusy] = useState(false);
>>>>>>> Stashed changes

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

  /**
   * HeyGen’s SDK uses LiveKit WebRTC; tearing down the room often logs
   * `Unknown DataChannel error on lossy` / `reliable` to the console. That is
   * usually harmless, but Next.js dev treats `console.error` as a runtime error.
   * Filter for the lifetime of this page so teardown after `sessionActive` goes
   * false is still covered.
   */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const orig = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      const head = args[0];
      const text =
        typeof head === "string"
          ? head
          : head instanceof Error
            ? head.message
            : String(head ?? "");
      if (text.includes("Unknown DataChannel error on")) return;
      orig(...args);
    };
    return () => {
      console.error = orig;
    };
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

  useEffect(() => {
    setInterviewModeState(searchParams.get("mode") === "technical" ? "technical" : "behavioral");
  }, [searchParams]);

  const setInterviewMode = useCallback(
    (mode: "behavioral" | "technical") => {
      if (sessionActive || isAvatarStarting) return;
      setInterviewModeState(mode);
      const q = new URLSearchParams(searchParams.toString());
      if (mode === "technical") q.set("mode", "technical");
      else q.delete("mode");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [isAvatarStarting, pathname, router, searchParams, sessionActive]
  );

  const handleResumeFile = useCallback(async (file: File | undefined) => {
    setResumeError("");
    setResumeLabel("");
    setResumeText("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setResumeError("Please choose a PDF file.");
      return;
    }
    setResumeLabel(file.name);
    setResumeParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      if (!data.text?.trim()) {
        throw new Error("No text extracted from PDF");
      }
      setResumeText(data.text);
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : "Could not read PDF");
      setResumeLabel("");
    } finally {
      setResumeParsing(false);
    }
  }, []);

  const bodyLanguage = useBodyLanguageAnalysis(userVideoRef, sessionActive && cameraOn);

  useEffect(() => {
    if (typeof window === "undefined") return;
    type RecResultList = { length: number; [i: number]: { 0: { transcript: string } } };
    type Rec = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((e: { results: RecResultList }) => void) | null;
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

    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let full = "";
        const { results } = event;
        for (let i = 0; i < results.length; i++) {
          const item = results[i]?.[0];
          if (item?.transcript) {
            full += item.transcript;
          }
        }
        setInput(full);
      };

      recognition.onerror = (event) => {
        const code = event.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          micActiveIntentRef.current = false;
          setIsListening(false);
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
    }
  }, []);

  const stopSpeechRecognitionUserIntent = useCallback(() => {
    micActiveIntentRef.current = false;
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
  }, []);

  const toggleListening = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (micActiveIntentRef.current) {
      stopSpeechRecognitionUserIntent();
    } else {
      micActiveIntentRef.current = true;
      setInput("");
      try {
        r.start();
        setIsListening(true);
      } catch {
        micActiveIntentRef.current = false;
        setIsListening(false);
      }
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

  const ensureMeetingRecording = useCallback(async (): Promise<{ recordingId: string; blobPath: string } | null> => {
    if (meetingRecordingIdRef.current && meetingBlobPathRef.current) {
      return { recordingId: meetingRecordingIdRef.current, blobPath: meetingBlobPathRef.current };
    }
    const res = await fetch("/api/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: interviewMode }),
    });
    if (res.status === 401) {
      alert("Sign in again to save a meeting recording.");
      return null;
    }
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      alert(d.error || "Could not create recording.");
      return null;
    }
    const data = (await res.json()) as { id?: string; meetingBlobPath?: string };
    if (!data.id || !data.meetingBlobPath) return null;
    meetingRecordingIdRef.current = data.id;
    meetingBlobPathRef.current = data.meetingBlobPath;
    return { recordingId: data.id, blobPath: data.meetingBlobPath };
  }, [interviewMode]);

  const stopMeetingRecordingAndUpload = useCallback(async () => {
    if (meetingStopUploadPromiseRef.current) {
      await meetingStopUploadPromiseRef.current;
      return;
    }

    const work = (async () => {
      const recorder = meetingRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        stopCompositeDraw(meetingComposeRafRef);
        meetingRecordStreamRef.current?.getTracks().forEach((t) => t.stop());
        meetingRecordStreamRef.current = null;
        meetingRecorderRef.current = null;
        setMeetingRecordState("idle");
        return;
      }

      setMeetingRecordState("uploading");
      const mimeType = recorder.mimeType || "video/webm";

      await new Promise<void>((resolve) => {
        const done = () => resolve();
        recorder.addEventListener("stop", done, { once: true });
        try {
          recorder.stop();
        } catch {
          done();
        }
      });

      stopCompositeDraw(meetingComposeRafRef);
      const s = meetingRecordStreamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        meetingRecordStreamRef.current = null;
      }
      meetingRecorderRef.current = null;

      const recordingId = meetingRecordingIdRef.current;
      const blobPath = meetingBlobPathRef.current;
      const chunks = meetingChunksRef.current;
      meetingChunksRef.current = [];
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size < 64 || !recordingId || !blobPath) {
        setMeetingRecordState("idle");
        return;
      }

      try {
        const result = await upload(blobPath, blob, {
          access: "public",
          handleUploadUrl: "/api/meeting-blob",
          clientPayload: JSON.stringify({ recordingId }),
          contentType: blobUploadContentType(blob.type || mimeType),
          multipart: true,
        });
        const patchRes = await fetch(`/api/recordings/${recordingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingVideoUrl: result.url }),
        });
        if (!patchRes.ok) {
          throw new Error("Saved file but could not link to your account.");
        }
        alert("Recording saved. Open Recordings on the dashboard to watch or share.");
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setMeetingRecordState("idle");
      }
    })();

    meetingStopUploadPromiseRef.current = work;
    try {
      await work;
    } finally {
      meetingStopUploadPromiseRef.current = null;
    }
  }, []);

  const startMeetingRecording = useCallback(async () => {
    if (!sessionActive || meetingRecordState !== "idle" || meetingRecorderRef.current) return;
    const avatarEl = document.getElementById("avatar-video") as HTMLVideoElement | null;
    if (!avatarEl) return;

    const ensured = await ensureMeetingRecording();
    if (!ensured) return;

    const includeCamera = cameraOn;
    const userEl = userVideoRef.current;
    const stream = buildMeetingRecordStream(avatarEl, userEl, includeCamera, meetingComposeRafRef);
    if (!stream || stream.getTracks().length === 0) {
      alert("Recording is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    meetingRecordStreamRef.current = stream;
    meetingChunksRef.current = [];

    const mime = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      console.error(e);
      stopCompositeDraw(meetingComposeRafRef);
      stream.getTracks().forEach((t) => t.stop());
      meetingRecordStreamRef.current = null;
      alert("Could not start recording.");
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) meetingChunksRef.current.push(e.data);
    };

    meetingRecorderRef.current = recorder;
    try {
      recorder.start(1000);
      setMeetingRecordState("recording");
    } catch (e) {
      console.error(e);
      stopCompositeDraw(meetingComposeRafRef);
      stream.getTracks().forEach((t) => t.stop());
      meetingRecordStreamRef.current = null;
      meetingRecorderRef.current = null;
      alert("Could not start recording.");
    }
  }, [sessionActive, meetingRecordState, cameraOn, ensureMeetingRecording]);

  useEffect(() => {
    if (!cameraOn) return;
    const stream = userStreamRef.current;
    const el = userVideoRef.current;
    if (!stream || !el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [cameraOn]);

<<<<<<< Updated upstream
  const stopAvatarSession = async () => {
    await stopMeetingRecordingAndUpload();

=======
  const discardLiveRecording = useCallback(async () => {
    const id = recordingIdRef.current;
    recordingIdRef.current = null;
    if (!id) return;
    try {
      await fetch(`/api/recordings/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("Discard recording:", e);
    }
  }, []);

  const stopMeetingRecording = useCallback((wantBlob: boolean): Promise<Blob | null> => {
    meetingRecorderStartedRef.current = false;
    const mr = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    const mic = recorderMicStreamRef.current;
    recorderMicStreamRef.current = null;
    mic?.getTracks().forEach((t) => t.stop());

    return new Promise((resolve) => {
      if (!mr || mr.state === "inactive") {
        recordedChunksRef.current = [];
        resolve(null);
        return;
      }
      mr.onstop = () => {
        const chunks = [...recordedChunksRef.current];
        recordedChunksRef.current = [];
        const mime = recordedMimeRef.current || "video/webm";
        if (wantBlob && chunks.length > 0) {
          resolve(new Blob(chunks, { type: mime }));
        } else {
          resolve(null);
        }
      };
      try {
        mr.stop();
      } catch {
        recordedChunksRef.current = [];
        resolve(null);
      }
    });
  }, []);

  const startMeetingRecording = useCallback(async (videoEl: HTMLVideoElement) => {
    if (meetingRecorderStartedRef.current || typeof MediaRecorder === "undefined") return;
    recordedChunksRef.current = [];
    const v = videoEl as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream };
    const cap = v.captureStream?.(24);
    if (!cap || cap.getVideoTracks().length === 0) return;
    const tracks: MediaStreamTrack[] = [...cap.getVideoTracks()];
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      recorderMicStreamRef.current = mic;
      const at = mic.getAudioTracks()[0];
      if (at) tracks.push(at);
    } catch {
      /* avatar video only */
    }
    const out = new MediaStream(tracks);
    const mime = pickMeetingRecorderMime();
    recordedMimeRef.current = mime;
    try {
      const mr = new MediaRecorder(out, { mimeType: mime });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      meetingRecorderStartedRef.current = true;
    } catch (e) {
      console.error("MediaRecorder start:", e);
      recorderMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      recorderMicStreamRef.current = null;
    }
  }, []);

  const stopAvatarSession = async (opts?: { skipRecordingDiscard?: boolean }) => {
>>>>>>> Stashed changes
    const shell = stageContainerRef.current;
    if (shell && getFullscreenElement() === shell) {
      try {
        await exitDocumentFullscreen();
      } catch {
        /* ignore */
      }
    }

    void stopMeetingRecording(false);

    if (!opts?.skipRecordingDiscard && recordingIdRef.current && !recordingSavedRef.current) {
      await discardLiveRecording();
    } else {
      recordingIdRef.current = null;
    }
    recordingSavedRef.current = false;

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
    brainSessionIdRef.current = null;
    stopUserCamera();

    stopSpeechRecognitionUserIntent();
    setLeaveDialogOpen(false);
  };

  useEffect(() => {
    if (!sessionActive) return;
    const video = document.getElementById("avatar-video") as HTMLVideoElement | null;
    if (!video) return;

    let cancelled = false;
    const tryStart = () => {
      if (cancelled || meetingRecorderStartedRef.current) return;
      void startMeetingRecording(video);
    };

    video.addEventListener("playing", tryStart, { once: true });
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !video.paused) {
      tryStart();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("playing", tryStart);
    };
  }, [sessionActive, startMeetingRecording]);

  const startAvatarSession = async () => {
    if (isAvatarStarting || sessionActive) return;
    if (resumeParsing) {
      alert("Wait for the resume PDF to finish processing, or remove the file.");
      return;
    }

    const knowledge = buildInterviewKnowledge({
      jobTitle,
      company,
      jobDescription,
      resumeText,
      sessionNote: `LiveAvatar mock interview. Mode: ${interviewMode}. Interviewer: ${interviewerGender}.`,
    });
    interviewContextRef.current = knowledge;

    setIsAvatarStarting(true);
    setMessages([]);
    brainSessionIdRef.current = null;
<<<<<<< Updated upstream
    meetingRecordingIdRef.current = null;
    meetingBlobPathRef.current = null;
=======
    recordingIdRef.current = null;
    recordingSavedRef.current = false;
>>>>>>> Stashed changes

    const modeAtStart = interviewMode;
    const genderAtStart = interviewerGender;

    try {
      const tokenRes = await fetch("/api/get-access-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewer: genderAtStart,
          interviewMode: modeAtStart,
          profileContext: knowledge,
        }),
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
        void (async () => {
          try {
            const res = await fetch("/api/recordings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: modeAtStart === "behavioral" ? "behavioral" : "technical",
                source: "live_avatar",
              }),
            });
            const j = (await res.json()) as { id?: string };
            if (res.ok && j.id) {
              recordingIdRef.current = j.id;
            }
          } catch (e) {
            console.error("Recording row:", e);
          }
        })();
        if (modeAtStart === "behavioral") {
          void (async () => {
            try {
              const startRes = await fetch("/api/interview-brain/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  knowledge,
                  mode: "behavioral",
                }),
              });
              const data = (await startRes.json()) as {
                session_id?: string;
                response?: string;
                error?: string;
              };
              if (!startRes.ok || !data.session_id || !data.response) {
                throw new Error(data.error || "Interview brain failed to start");
              }
              brainSessionIdRef.current = data.session_id;
              setMessages([{ role: "ai", text: data.response }]);
              setInterviewerSubtitle(data.response);
              const a = avatarRef.current;
              if (a) {
                try {
                  await a.repeat(data.response);
                } catch (sdkError) {
                  console.error("Avatar repeat failed:", sdkError);
                }
              }
            } catch (e) {
              console.error("Behavioral brain start:", e);
              alert(
                "Could not start the behavioral interview engine. Run the Python API: uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"
              );
            }
          })();
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

    stopSpeechRecognitionUserIntent();

    const userText = input;
    setInput("");

    const currentMessages = [...messages, { role: "user", text: userText }];
    setMessages(currentMessages);
    setIsChatting(true);

    try {
      let aiResponse: string;

      if (interviewMode === "behavioral") {
        const sid = brainSessionIdRef.current;
        if (!sid) {
          throw new Error("Behavioral session not ready yet. Wait for the interviewer to finish speaking.");
        }
        const chatRes = await fetch("/api/interview-brain/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, answer: userText }),
        });
        const chatData = (await chatRes.json()) as { response?: string; error?: string };
        if (!chatRes.ok || !chatData.response) {
          throw new Error(chatData.error || "Interview brain did not respond");
        }
        aiResponse = chatData.response;
      } else {
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
            interviewContext: interviewContextRef.current,
          }),
        });

        const chatData = (await chatRes.json()) as { response?: string; error?: string };

        if (!chatRes.ok || !chatData.response) {
          throw new Error(chatData.error || "Gemini did not respond");
        }

        aiResponse = chatData.response;
      }
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

  useEffect(() => {
    return () => {
      const rec = meetingRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      stopCompositeDraw(meetingComposeRafRef);
      meetingRecordStreamRef.current?.getTracks().forEach((t) => t.stop());
      meetingRecordStreamRef.current = null;
      meetingRecorderRef.current = null;
    };
  }, []);

  const meetingShell = clsx(
    "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 shadow-sm",
    "dark:border-neutral-700 dark:shadow-neutral-950/40 lg:min-h-[min(780px,calc(100dvh-9rem))]",
    isStageFullscreen &&
      "h-screen max-h-screen w-screen max-w-none rounded-none border-0 shadow-none lg:min-h-0"
  );

  const handleLeaveEndOnly = async () => {
    setLeaveDialogOpen(false);
    await discardLiveRecording();
    await stopMeetingRecording(false);
    await stopAvatarSession({ skipRecordingDiscard: true });
  };

  const handleLeaveSave = async () => {
    setLeaveDialogOpen(false);
    const id = recordingIdRef.current;
    if (!id) {
      await stopMeetingRecording(false);
      await stopAvatarSession({ skipRecordingDiscard: true });
      return;
    }
    setSaveRecordingBusy(true);
    try {
      const blob = await stopMeetingRecording(true);
      const res = await fetch(`/api/recordings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesRef.current, saveTranscript: true }),
      });
      if (!res.ok) {
        alert("Could not save your transcript. The session will end without saving.");
        await discardLiveRecording();
        await stopAvatarSession({ skipRecordingDiscard: true });
        return;
      }
      recordingSavedRef.current = true;
      if (blob && blob.size > 0) {
        triggerWebmDownload(blob, id);
      }
      recordingIdRef.current = null;
      await stopAvatarSession({ skipRecordingDiscard: true });
      router.push("/dashboard/recordings");
      router.refresh();
    } finally {
      setSaveRecordingBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 shrink-0 lg:mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
          Mock Interview
        </h1>
      </div>

      <div ref={stageContainerRef} className={meetingShell}>
        {/* Main stage — avatar / video */}
        <div
          className={clsx(
            "relative flex min-h-[min(52vh,420px)] flex-1 flex-col bg-neutral-950 lg:min-h-0",
            isStageFullscreen && "min-h-0 h-full"
          )}
        >
          <div className="absolute right-5 top-3 z-20 flex items-center gap-2 sm:right-6">
            {!sessionActive ? (
              <Listbox
                value={interviewMode}
                onChange={(v: "behavioral" | "technical") => setInterviewMode(v)}
                disabled={isAvatarStarting}
              >
                <ListboxButton
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-left text-xs font-medium text-white/95 shadow-lg backdrop-blur-sm transition-colors",
                    "border-white/20 bg-neutral-900/90 hover:bg-neutral-800/95",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                    isAvatarStarting && "cursor-not-allowed opacity-50"
                  )}
                  aria-label="Interview mode"
                >
                  <span className="whitespace-nowrap">{interviewMode === "behavioral" ? "Behavioral" : "Technical"}</span>
                  <svg className="h-3 w-3 shrink-0 text-white/60" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </ListboxButton>
                <ListboxOptions
                  anchor="bottom end"
                  portal
                  modal={false}
                  className={clsx(
                    "z-[100] min-w-36 rounded-lg border py-0.5 shadow-xl [--anchor-gap:6px]",
                    "border-white/15 bg-neutral-950/95 text-white backdrop-blur-md",
                    "focus:outline-none"
                  )}
                >
                  <ListboxOption
                    value="behavioral"
                    className="cursor-pointer px-3 py-1.5 text-xs text-white/95 data-focus:bg-white/10"
                  >
                    Behavioral
                  </ListboxOption>
                  <ListboxOption
                    value="technical"
                    className="cursor-pointer px-3 py-1.5 text-xs text-white/95 data-focus:bg-white/10"
                  >
                    Technical
                  </ListboxOption>
                </ListboxOptions>
              </Listbox>
            ) : (
              <span
                className="rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm"
                title="Mode is fixed for this session"
              >
                {interviewMode === "behavioral" ? "Behavioral" : "Technical"}
              </span>
            )}
            {!sessionActive && (
              <button
                type="button"
                onClick={() => void toggleStageFullscreen()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-neutral-900/85 text-white shadow-lg backdrop-blur-sm hover:bg-neutral-800"
                title={isStageFullscreen ? "Exit full screen" : "Full screen"}
                aria-label={isStageFullscreen ? "Exit full screen" : "Enter full screen"}
              >
                {isStageFullscreen ? <IconFullscreenExit /> : <IconFullscreenEnter />}
              </button>
            )}
          </div>

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
            <div className="absolute inset-0 z-10 flex flex-col items-center overflow-y-auto overflow-x-hidden bg-neutral-950 px-4 py-6">
              <div className="flex w-full max-w-lg flex-col items-stretch gap-5 sm:max-w-xl">
                <div className="rounded-xl border border-white/10 bg-neutral-900/50 p-4 text-left">
                  <p className="text-sm font-semibold text-neutral-100">Role context (optional)</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Add any details you want—the avatar and interviewer use them when provided. Technical vs behavioral follows
                    the mode in the corner. Nothing here is required to start.
                  </p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label htmlFor="prejoin-job-title" className="mb-1 block text-xs font-medium text-neutral-400">
                        Job title <span className="text-neutral-600">(optional)</span>
                      </label>
                      <input
                        id="prejoin-job-title"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        disabled={isAvatarStarting}
                        placeholder="e.g. Software Engineer Intern"
                        className={prejoinFieldClass}
                        autoComplete="organization-title"
                      />
                    </div>
                    <div>
                      <label htmlFor="prejoin-company" className="mb-1 block text-xs font-medium text-neutral-400">
                        Company <span className="text-neutral-600">(optional)</span>
                      </label>
                      <input
                        id="prejoin-company"
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        disabled={isAvatarStarting}
                        placeholder="e.g. Acme Corp"
                        className={prejoinFieldClass}
                        autoComplete="organization"
                      />
                    </div>
                    <div>
                      <label htmlFor="prejoin-jd" className="mb-1 block text-xs font-medium text-neutral-400">
                        Job description <span className="text-neutral-600">(optional)</span>
                      </label>
                      <textarea
                        id="prejoin-jd"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        disabled={isAvatarStarting}
                        placeholder="Paste the role summary, requirements, or what you want to practice for."
                        rows={4}
                        className={clsx(prejoinFieldClass, "resize-y min-h-[88px]")}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-neutral-400">
                        Resume (PDF) <span className="text-neutral-600">(optional)</span>
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={isAvatarStarting || resumeParsing}
                        onChange={(e) => void handleResumeFile(e.target.files?.[0])}
                        className="block w-full text-xs text-neutral-400 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1.5 file:text-xs file:text-neutral-200"
                      />
                      {resumeParsing ? (
                        <p className="mt-1 text-xs text-neutral-500">Extracting text from PDF…</p>
                      ) : resumeLabel ? (
                        <p className="mt-1 text-xs text-emerald-400/90">
                          Loaded: {resumeLabel} ({resumeText.length.toLocaleString()} characters)
                        </p>
                      ) : null}
                      {resumeError ? <p className="mt-1 text-xs text-red-400">{resumeError}</p> : null}
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-200">Choose your interviewer</p>
                  <p className="mt-1 text-xs text-neutral-500">Then start the session.</p>
                </div>
              </div>
              <fieldset className="mt-2 flex w-full max-w-lg flex-col gap-3 sm:max-w-xl">
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
              <p className="mt-4 text-center text-sm text-neutral-400">Video off until you connect.</p>
              <Button
                type="button"
                onClick={() => void startAvatarSession()}
                disabled={isAvatarStarting || resumeParsing}
                className={clsx(lightPrimaryButton, "mx-auto mt-2")}
                title={resumeParsing ? "Wait for PDF text extraction to finish" : undefined}
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
                  danger={meetingRecordState === "recording"}
                  active={false}
                  label={
                    meetingRecordState === "uploading"
                      ? "Saving recording…"
                      : meetingRecordState === "recording"
                        ? "Stop and save recording"
                        : "Record meeting"
                  }
                  onClick={() => {
                    if (meetingRecordState === "recording") void stopMeetingRecordingAndUpload();
                    else void startMeetingRecording();
                  }}
                  disabled={isChatting || meetingRecordState === "uploading"}
                >
                  <IconRecord />
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
                  onClick={() => setLeaveDialogOpen(true)}
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

      <Dialog
        open={leaveDialogOpen}
        onClose={() => {
          if (!saveRecordingBusy) setLeaveDialogOpen(false);
        }}
        className="relative z-[200]"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/55 backdrop-blur-sm transition-opacity data-closed:opacity-0" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl dark:border-neutral-600 dark:bg-neutral-950">
            <DialogTitle className="text-lg font-semibold text-white">Leave mock interview?</DialogTitle>
            <Description className="mt-2 text-sm text-neutral-400">
              Your session is being captured in the browser (avatar video and your mic when allowed).{" "}
              <strong className="font-medium text-neutral-200">Save</strong> stores the full transcript in Recordings and
              downloads a local .webm clip. <strong className="font-medium text-neutral-200">End without saving</strong>{" "}
              removes the draft recording.
            </Description>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                disabled={saveRecordingBusy}
                onClick={() => setLeaveDialogOpen(false)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveRecordingBusy}
                onClick={() => void handleLeaveEndOnly()}
                className="rounded-xl border border-red-500/50 bg-red-950/80 px-4 py-2.5 text-sm font-semibold text-red-100 transition-colors hover:bg-red-900/90 disabled:opacity-50"
              >
                End without saving
              </button>
              <button
                type="button"
                disabled={saveRecordingBusy}
                onClick={() => void handleLeaveSave()}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-50"
              >
                {saveRecordingBusy ? "Saving…" : "Save recording"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
