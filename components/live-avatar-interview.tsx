"use client";

import {
  Button,
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
import {
  CodeEditorPanel,
  type KeystrokeSummary,
  type LangId,
} from "@/components/code-editor";
import { CodingProblemPanel } from "@/components/coding-problem-panel";
import { useCodingInterviewBrain } from "@/hooks/use-coding-interview-brain";
import { interviewApiBase } from "@/lib/coding-interview-api";

const PIP_WIDTH_MIN = 120;
const PIP_WIDTH_MAX = 480;
const PIP_WIDTH_STORAGE = "trueface-pip-width";
const PIP_TRANSLATE_STORAGE = "trueface-pip-translate";
const TOOLBAR_TRANSLATE_STORAGE = "trueface-toolbar-translate";

const prejoinFieldClass =
  "w-full rounded-lg border border-white/15 bg-neutral-900/90 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-white/35 focus:outline-none focus:ring-1 focus:ring-white/20";

const CODING_INTEGRITY_LABELS: Record<string, string> = {
  heavy_paste:
    "A large block of text was inserted at once — many proctored platforms flag sudden large pastes.",
  frequent_tab_away:
    "The tab was switched away from several times — real assessments often log focus changes.",
  long_idle: "There was a long stretch with no typing — timed sessions may flag extended idle periods.",
  timed_out: "The coding timer ran out before submit (your attempt was still recorded).",
};

function codingIntegrityLines(flags: string[]): string[] {
  return flags.map((f) => CODING_INTEGRITY_LABELS[f] ?? f);
}

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

function pickMeetingRecorderMime(): string {
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

/**
 * Meeting record stream from captureStream() has interviewer audio but not the user's mic.
 * Mix both into one track so replays include the candidate's voice (MediaRecorder often muxes a single audio track).
 */
async function addUserMicToMeetingStream(baseStream: MediaStream): Promise<{
  stream: MediaStream;
  release: () => void;
}> {
  const videoTracks = baseStream.getVideoTracks();
  const origAudio = baseStream.getAudioTracks();

  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    /* optional — keep avatar-only if denied */
  }
  const micTrack = micStream?.getAudioTracks()[0] ?? null;

  const stopMic = () => {
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
  };

  if (!micTrack) {
    return { stream: baseStream, release: stopMic };
  }

  if (origAudio.length === 0) {
    return {
      stream: new MediaStream([...videoTracks, micTrack]),
      release: stopMic,
    };
  }

  const Ctx =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (typeof window !== "undefined"
          ? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined);
  if (!Ctx) {
    return {
      stream: new MediaStream([...videoTracks, micTrack]),
      release: stopMic,
    };
  }

  const ctx = new Ctx();
  await ctx.resume().catch(() => {});
  const dest = ctx.createMediaStreamDestination();
  let ok = false;
  for (const t of origAudio) {
    try {
      ctx.createMediaStreamSource(new MediaStream([t])).connect(dest);
      ok = true;
    } catch {
      /* skip */
    }
  }
  try {
    ctx.createMediaStreamSource(new MediaStream([micTrack])).connect(dest);
    ok = true;
  } catch {
    stopMic();
    void ctx.close();
    return { stream: baseStream, release: () => {} };
  }

  const mixedTrack = dest.stream.getAudioTracks()[0];
  if (!mixedTrack || !ok) {
    stopMic();
    void ctx.close();
    return { stream: baseStream, release: () => {} };
  }

  return {
    stream: new MediaStream([...videoTracks, mixedTrack]),
    release: () => {
      void ctx.close();
      stopMic();
    },
  };
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
  const pipMoveDragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const toolbarMoveDragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const answerInputRef = useRef<HTMLInputElement | null>(null);

  // TrueFace ML Engine
  const ML_ENGINE_URL = "http://localhost:8001";
  const sessionParam = searchParams.get("session");
  const candidateId = useRef(sessionParam ? `candidate_${sessionParam}` : `candidate_${Date.now()}`);
  const isLiveInterview = Boolean(sessionParam);
  const [mlConnected, setMlConnected] = useState(false);
  const [mlScores, setMlScores] = useState<{
    final_score: number;
    risk_level: string;
    signal_breakdown: Record<string, { score: number; label: string }>;
  } | null>(null);
  const [monitorCopied, setMonitorCopied] = useState(false);
  const [monitorUrl, setMonitorUrl] = useState("");
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const recordingIdRef = useRef<string | null>(null);
  const recordingSavedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordedMimeRef = useRef("");
  const recorderMicStreamRef = useRef<MediaStream | null>(null);
  const sessionWebmRecorderStartedRef = useRef(false);

  const codingBrain = useCodingInterviewBrain();
  const codingBrainRef = useRef(codingBrain);
  codingBrainRef.current = codingBrain;

  const meetingComposeRafRef = useRef<number | null>(null);
  const meetingRecordStreamRef = useRef<MediaStream | null>(null);
  const meetingRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingChunksRef = useRef<Blob[]>([]);
  const meetingRecordingIdRef = useRef<string | null>(null);
  const meetingBlobPathRef = useRef<string | null>(null);
  const meetingStopUploadPromiseRef = useRef<Promise<void> | null>(null);
  const meetingRecordMixReleaseRef = useRef<(() => void) | null>(null);

  const [meetingRecordState, setMeetingRecordState] = useState<"idle" | "recording" | "uploading">("idle");
  const [pipWidth, setPipWidthState] = useState(200);
  const [pipTranslate, setPipTranslate] = useState({ x: 0, y: 0 });
  const [toolbarTranslate, setToolbarTranslate] = useState({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIP_WIDTH_STORAGE);
      if (raw) {
        const n = Number.parseInt(raw, 10);
        if (!Number.isNaN(n)) {
          setPipWidthState(Math.min(PIP_WIDTH_MAX, Math.max(PIP_WIDTH_MIN, n)));
        }
      }
      const pt = localStorage.getItem(PIP_TRANSLATE_STORAGE);
      if (pt) {
        const j = JSON.parse(pt) as { x?: number; y?: number };
        if (typeof j.x === "number" && typeof j.y === "number") {
          setPipTranslate({ x: j.x, y: j.y });
        }
      }
      const tt = localStorage.getItem(TOOLBAR_TRANSLATE_STORAGE);
      if (tt) {
        const j = JSON.parse(tt) as { x?: number; y?: number };
        if (typeof j.x === "number" && typeof j.y === "number") {
          setToolbarTranslate({ x: j.x, y: j.y });
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

  const clampPipTranslate = useCallback(
    (x: number, y: number) => {
      const shell = stageContainerRef.current;
      if (!shell) return { x, y };
      const rect = shell.getBoundingClientRect();
      const w = pipWidth;
      const h = (w * 9) / 16;
      const margin = 8;
      const bottomChrome = 96;
      const minX = -(rect.width - w - margin * 2);
      const minY = -(rect.height - h - margin - bottomChrome);
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [pipWidth]
  );

  const clampToolbarTranslate = useCallback((x: number, y: number) => {
    const shell = stageContainerRef.current;
    if (!shell) return { x, y };
    const rect = shell.getBoundingClientRect();
    const margin = 8;
    return {
      x: Math.min(rect.width / 2 - margin, Math.max(-rect.width / 2 + margin, x)),
      y: Math.min(-margin, Math.max(-rect.height + 80, y)),
    };
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


  // TrueFace ML Engine effects
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${ML_ENGINE_URL}/session/start?candidate_id=${candidateId.current}`, { method: "POST" });
        if (res.ok) setMlConnected(true);
      } catch {}
    };
    init();
  }, []);

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const res = await fetch(`${ML_ENGINE_URL}/session/report?candidate_id=${candidateId.current}&candidate_name=Candidate`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data?.final_score !== undefined) setMlScores(data);
        }
      } catch {}
    };
    fetchScores();
    const interval = setInterval(fetchScores, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionActive) return;
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    frameIntervalRef.current = setInterval(async () => {
      if (!userVideoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      canvasRef.current.width = 320;
      canvasRef.current.height = 240;
      ctx.drawImage(userVideoRef.current, 0, 0, 320, 240);
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");
        try {
          await fetch(`${ML_ENGINE_URL}/analyze/frame?candidate_id=${candidateId.current}`, { method: "POST", body: formData });
        } catch {}
      }, "image/jpeg", 0.8);
    }, 3000);
    return () => { if (frameIntervalRef.current) clearInterval(frameIntervalRef.current); };
  }, [sessionActive]);

  useEffect(() => {
    setMonitorUrl(`${window.location.origin}/monitor/${candidateId.current}`);
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

  const releaseMeetingRecordMix = useCallback(() => {
    meetingRecordMixReleaseRef.current?.();
    meetingRecordMixReleaseRef.current = null;
  }, []);

  const stopMeetingRecordingAndUpload = useCallback(async () => {
    if (meetingStopUploadPromiseRef.current) {
      await meetingStopUploadPromiseRef.current;
      return;
    }

    const work = (async () => {
      const recorder = meetingRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        stopCompositeDraw(meetingComposeRafRef);
        releaseMeetingRecordMix();
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
      releaseMeetingRecordMix();
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
  }, [releaseMeetingRecordMix]);

  const startMeetingRecording = useCallback(async () => {
    if (!sessionActive || meetingRecordState !== "idle" || meetingRecorderRef.current) return;
    const avatarEl = document.getElementById("avatar-video") as HTMLVideoElement | null;
    if (!avatarEl) return;

    const ensured = await ensureMeetingRecording();
    if (!ensured) return;

    const includeCamera = cameraOn;
    const userEl = userVideoRef.current;
    const baseStream = buildMeetingRecordStream(avatarEl, userEl, includeCamera, meetingComposeRafRef);
    if (!baseStream || baseStream.getTracks().length === 0) {
      alert("Recording is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    let finalStream: MediaStream;
    try {
      const mixed = await addUserMicToMeetingStream(baseStream);
      meetingRecordMixReleaseRef.current = mixed.release;
      finalStream = mixed.stream;
    } catch (e) {
      console.error(e);
      stopCompositeDraw(meetingComposeRafRef);
      baseStream.getTracks().forEach((t) => t.stop());
      alert("Could not set up microphone for recording. Check permissions and try again.");
      return;
    }

    meetingRecordStreamRef.current = finalStream;
    meetingChunksRef.current = [];

    const mime = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(finalStream, { mimeType: mime }) : new MediaRecorder(finalStream);
    } catch (e) {
      console.error(e);
      releaseMeetingRecordMix();
      stopCompositeDraw(meetingComposeRafRef);
      finalStream.getTracks().forEach((t) => t.stop());
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
      releaseMeetingRecordMix();
      stopCompositeDraw(meetingComposeRafRef);
      finalStream.getTracks().forEach((t) => t.stop());
      meetingRecordStreamRef.current = null;
      meetingRecorderRef.current = null;
      alert("Could not start recording.");
    }
  }, [sessionActive, meetingRecordState, cameraOn, ensureMeetingRecording, releaseMeetingRecordMix]);

  useEffect(() => {
    if (!cameraOn) return;
    const stream = userStreamRef.current;
    const el = userVideoRef.current;
    if (!stream || !el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [cameraOn]);

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

  const stopSessionWebmRecording = useCallback((wantBlob: boolean): Promise<Blob | null> => {
    sessionWebmRecorderStartedRef.current = false;
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

  const startSessionWebmRecording = useCallback(async (videoEl: HTMLVideoElement) => {
    if (sessionWebmRecorderStartedRef.current || typeof MediaRecorder === "undefined") return;
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
      sessionWebmRecorderStartedRef.current = true;
    } catch (e) {
      console.error("MediaRecorder start:", e);
      recorderMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      recorderMicStreamRef.current = null;
    }
  }, []);

  const discardCompositeMeetingRecorder = useCallback(() => {
    const rec = meetingRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    stopCompositeDraw(meetingComposeRafRef);
    releaseMeetingRecordMix();
    meetingRecordStreamRef.current?.getTracks().forEach((t) => t.stop());
    meetingRecordStreamRef.current = null;
    meetingRecorderRef.current = null;
    meetingChunksRef.current = [];
    setMeetingRecordState("idle");
  }, [releaseMeetingRecordMix]);

  const stopAvatarSession = async (opts?: { skipRecordingDiscard?: boolean }) => {
    discardCompositeMeetingRecorder();

    const shell = stageContainerRef.current;
    if (shell && getFullscreenElement() === shell) {
      try {
        await exitDocumentFullscreen();
      } catch {
        /* ignore */
      }
    }

    await stopSessionWebmRecording(false);

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
    codingBrain.reset();
    stopUserCamera();

    stopSpeechRecognitionUserIntent();
  };

  useEffect(() => {
    if (!sessionActive) return;
    const video = document.getElementById("avatar-video") as HTMLVideoElement | null;
    if (!video) return;

    let cancelled = false;
    const tryStart = () => {
      if (cancelled || sessionWebmRecorderStartedRef.current) return;
      void startSessionWebmRecording(video);
    };

    video.addEventListener("playing", tryStart, { once: true });
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !video.paused) {
      tryStart();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("playing", tryStart);
    };
  }, [sessionActive, startSessionWebmRecording]);

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
    codingBrain.reset();
    recordingIdRef.current = null;
    recordingSavedRef.current = false;
    meetingRecordingIdRef.current = null;
    meetingBlobPathRef.current = null;

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
        } else {
          void (async () => {
            const started = await codingBrainRef.current.startBrain(knowledge);
            if (!started.ok) {
              console.error("Coding interview start:", started.error);
              alert(
                `Could not start the technical (coding) interview engine at ${interviewApiBase()}. Is the backend running?\n\n${started.error}`
              );
              return;
            }
            const opening = started.opening.trim();
            setMessages(opening ? [{ role: "ai", text: opening }] : []);
            if (opening) {
              setInterviewerSubtitle(opening);
              const a = avatarRef.current;
              if (a) {
                try {
                  await a.repeat(opening);
                } catch (sdkError) {
                  console.error("Avatar repeat failed:", sdkError);
                }
              }
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
        const turn = await codingBrain.sendChatTurn(userText);
        if (!turn.ok) {
          setMessages((prev) => [...prev, { role: "ai", text: `Error: ${turn.error}` }]);
          return;
        }
        aiResponse = turn.aiResponse;
        const displayText = turn.done
          ? `${aiResponse}\n\n(Interview complete.)`
          : turn.suppressAvatar
            ? (aiResponse.trim() || "Tests failed — see the panel below the editor.")
            : aiResponse;
        setMessages((prev) => [...prev, { role: "ai", text: displayText }]);
        setInterviewerSubtitle(aiResponse);
        if (aiResponse.trim() && !turn.suppressAvatar && avatarRef.current) {
          try {
            await avatarRef.current.repeat(aiResponse);
          } catch (sdkError) {
            console.error("Avatar repeat failed:", sdkError);
          }
        }
        return;
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

  const sendCodeSubmission = async (code: string, language: LangId, summary: KeystrokeSummary) => {
    if (interviewMode !== "technical" || isChatting || !codingBrain.brainReady) return;
    setIsChatting(true);
    setMessages((prev) => [...prev, { role: "user", text: `[Submitted ${language} code]` }]);
    try {
      const turn = await codingBrain.sendCodeTurn(code, language, summary);
      if (!turn.ok) {
        setMessages((prev) => [...prev, { role: "ai", text: `Error: ${turn.error}` }]);
        return;
      }
      const { aiResponse, done, suppressAvatar } = turn;
      const displayText = done
        ? `${aiResponse}\n\n(Interview complete.)`
        : suppressAvatar
          ? (aiResponse.trim() || "Tests failed — see results below the editor.")
          : aiResponse;
      setMessages((prev) => [...prev, { role: "ai", text: displayText }]);
      setInterviewerSubtitle(aiResponse.trim() ? aiResponse : displayText);
      if (aiResponse.trim() && !suppressAvatar && avatarRef.current) {
        try {
          await avatarRef.current.repeat(aiResponse);
        } catch (e) {
          console.error("Avatar repeat failed:", e);
        }
      }
    } finally {
      setIsChatting(false);
    }
  };

  const handleCodingGiveUp = async () => {
    if (interviewMode !== "technical" || isChatting || !codingBrain.brainReady) return;
    if (
      !window.confirm(
        "End the technical practice now? You’ll hear a closing message and the session will finish — no further questions."
      )
    ) {
      return;
    }
    setIsChatting(true);
    setMessages((prev) => [...prev, { role: "user", text: "Ended the coding exercise early." }]);
    try {
      const turn = await codingBrain.giveUpCoding();
      if (!turn.ok) {
        setMessages((prev) => [...prev, { role: "ai", text: `Error: ${turn.error}` }]);
        return;
      }
      const { aiResponse, suppressAvatar } = turn;
      const displayText =
        aiResponse.trim() ||
        "Thank you for the interview — we'll get back to you shortly.";
      setMessages((prev) => [...prev, { role: "ai", text: displayText }]);
      setInterviewerSubtitle(displayText);
      if (displayText && !suppressAvatar && avatarRef.current) {
        try {
          await avatarRef.current.repeat(displayText);
        } catch (e) {
          console.error("Avatar repeat failed:", e);
        }
      }
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
      meetingRecordMixReleaseRef.current?.();
      meetingRecordMixReleaseRef.current = null;
      meetingRecordStreamRef.current?.getTracks().forEach((t) => t.stop());
      meetingRecordStreamRef.current = null;
      meetingRecorderRef.current = null;

      const sessionMr = mediaRecorderRef.current;
      if (sessionMr && sessionMr.state !== "inactive") {
        try {
          sessionMr.stop();
        } catch {
          /* ignore */
        }
      }
      mediaRecorderRef.current = null;
      sessionWebmRecorderStartedRef.current = false;
      recorderMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      recorderMicStreamRef.current = null;
      recordedChunksRef.current = [];
    };
  }, []);

  const technicalCodingActive =
    interviewMode === "technical" &&
    sessionActive &&
    codingBrain.inputMode === "code" &&
    codingBrain.codingPrompt != null;

  const meetingShell = clsx(
    "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 shadow-sm",
    "dark:border-neutral-700 dark:shadow-neutral-950/40 lg:min-h-[min(780px,calc(100dvh-9rem))]",
    isStageFullscreen &&
      "h-screen max-h-screen w-screen max-w-none rounded-none border-0 shadow-none lg:min-h-0"
  );

  const getBarColor = (score: number) =>
    score < 0.35 ? "bg-green-500" : score < 0.55 ? "bg-yellow-500" : "bg-red-500";
  const getRiskColor = (risk: string) =>
    risk === "AUTHENTIC" || risk === "LOW RISK"
      ? "text-green-400"
      : risk === "MEDIUM RISK"
        ? "text-yellow-400"
        : "text-red-400";

  const sendDisabled =
    isChatting ||
    (interviewMode === "technical" &&
      (!codingBrain.brainReady || codingBrain.isStartingBrain || technicalCodingActive));

  const handleLeaveMeeting = async () => {
    await discardLiveRecording();
    await stopSessionWebmRecording(false);
    await stopAvatarSession({ skipRecordingDiscard: true });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 shrink-0 lg:mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
          Mock Interview
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <div ref={stageContainerRef} className={meetingShell}>
        {interviewMode === "technical" &&
          sessionActive &&
          codingBrain.integrityFlags.length > 0 &&
          !codingBrain.integrityDismissed && (
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-amber-500/25 bg-amber-950/40 px-3 py-2.5 text-xs text-amber-100 sm:px-4">
              <div>
                <span className="font-semibold text-amber-200/95">Practice note</span>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-100/90">
                  {codingIntegrityLines(codingBrain.integrityFlags).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="shrink-0 text-amber-300 underline hover:text-amber-200"
                onClick={() => codingBrain.setIntegrityDismissed(true)}
              >
                Dismiss
              </button>
            </div>
          )}
        <div
          className={clsx(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            technicalCodingActive && "lg:flex-row lg:items-stretch"
          )}
        >
          {/* Main stage — avatar / video */}
          <div
            className={clsx(
              "relative flex min-h-0 flex-1 flex-col bg-neutral-950 lg:min-h-0",
              technicalCodingActive &&
                "lg:min-h-[min(220px,32vh)] lg:max-w-[min(100%,560px)] lg:shrink-0 lg:border-r lg:border-white/10",
              isStageFullscreen && "min-h-0 h-full"
            )}
          >
          <div className="absolute right-5 top-3 z-20 flex items-center gap-2 sm:right-6">
            {sessionActive ? (
              <span
                className="rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm"
                title="Mode is fixed for this session"
              >
                {interviewMode === "behavioral" ? "Behavioral" : "Technical"}
              </span>
            ) : null}
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
            <div className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden bg-neutral-950 px-4 py-6 lg:px-6">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
                {/* Left: role context — wide column, stretches with interviewer side on desktop */}
                <div className="flex w-full shrink-0 flex-col items-stretch lg:sticky lg:top-6 lg:w-96 xl:w-[28rem]">
                  <div className="flex h-full min-h-[min(520px,62vh)] w-full max-w-sm flex-col rounded-lg border border-white/10 bg-neutral-900/50 px-5 py-5 text-left shadow-sm xl:max-w-none">
                    <p className="text-center text-sm font-semibold text-neutral-100">Role context (optional)</p>
                    <p className="mx-auto mt-2 max-w-[40ch] text-center text-xs leading-relaxed text-neutral-500">
                      Add any details you want—the avatar and interviewer use them when provided. Choose behavioral or
                      technical below.{" "}
                      <span className="text-neutral-400">
                        Technical mode uses the same coding engine as Code Interview (editor + tests) with this dashboard
                        UI.
                      </span>{" "}
                      Nothing here is required to start.
                    </p>
                    <div className="mt-4 flex justify-center">
                      <Listbox
                        value={interviewMode}
                        onChange={(v: "behavioral" | "technical") => setInterviewMode(v)}
                        disabled={isAvatarStarting}
                      >
                        <ListboxButton
                          className={clsx(
                            "inline-flex min-w-[10.5rem] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium text-neutral-100 transition-colors",
                            "border-white/15 bg-neutral-900/90 hover:bg-neutral-800/95",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                            isAvatarStarting && "cursor-not-allowed opacity-50"
                          )}
                          aria-label="Interview mode"
                        >
                          <span className="whitespace-nowrap">
                            {interviewMode === "behavioral" ? "Behavioral" : "Technical"}
                          </span>
                          <svg className="h-3 w-3 shrink-0 text-neutral-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </ListboxButton>
                        <ListboxOptions
                          anchor="bottom start"
                          portal
                          modal={false}
                          className={clsx(
                            "z-[100] min-w-[10.5rem] rounded-lg border py-0.5 shadow-xl [--anchor-gap:6px]",
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
                    </div>
                    <div className="mt-4 flex flex-1 flex-col space-y-4">
                      <div>
                        <label htmlFor="prejoin-job-title" className="mb-1.5 block text-xs font-medium text-neutral-400">
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
                        <label htmlFor="prejoin-company" className="mb-1.5 block text-xs font-medium text-neutral-400">
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
                      <div className="flex min-h-0 flex-1 flex-col">
                        <label htmlFor="prejoin-jd" className="mb-1.5 block text-xs font-medium text-neutral-400">
                          Job description <span className="text-neutral-600">(optional)</span>
                        </label>
                        <textarea
                          id="prejoin-jd"
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          disabled={isAvatarStarting}
                          placeholder="Paste the role summary, requirements, or what you want to practice for."
                          rows={6}
                          className={clsx(prejoinFieldClass, "min-h-[132px] flex-1 resize-y")}
                        />
                      </div>
                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-neutral-400">
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
                </div>

                {/* Right: interviewer + start */}
                <div className="flex min-w-0 flex-1 flex-col items-center">
                  <div className="text-center">
                    <p className="text-sm font-medium text-neutral-200">Choose your interviewer</p>
                    <p className="mt-1 text-xs text-neutral-500">Then start the session.</p>
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
                          "flex flex-col overflow-hidden rounded-xl border-2 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
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
                          "flex flex-col overflow-hidden rounded-xl border-2 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
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
                            interviewerGender === "female"
                              ? "bg-white text-neutral-900"
                              : "bg-neutral-900 text-neutral-200"
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
              </div>
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
              className={clsx(
                "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-black/90 via-black/55 to-transparent px-4",
                technicalCodingActive ? "pb-4 pt-10 sm:pb-5 sm:pt-12" : "pb-8 pt-16 sm:pb-10 sm:pt-20"
              )}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="sr-only">Interviewer</span>
              <p
                className={clsx(
                  "max-w-4xl overflow-y-auto text-center text-base font-medium leading-snug tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)] sm:text-lg",
                  technicalCodingActive ? "max-h-24 sm:max-h-28" : "max-h-32"
                )}
              >
                {interviewerSubtitle}
              </p>
            </div>
          ) : null}

          {sessionActive && interviewMode === "technical" && codingBrain.isStartingBrain && (
            <div className="pointer-events-none absolute bottom-20 left-3 right-3 z-20 rounded-lg bg-black/75 px-3 py-2 text-center text-xs text-white/95 sm:bottom-24">
              Connecting to coding interview engine…
            </div>
          )}
          {sessionActive &&
            interviewMode === "technical" &&
            !codingBrain.brainReady &&
            !codingBrain.isStartingBrain && (
              <div className="absolute bottom-20 left-3 right-3 z-20 flex justify-center sm:bottom-24">
                <button
                  type="button"
                  onClick={() =>
                    void (async () => {
                      const started = await codingBrainRef.current.startBrain(interviewContextRef.current);
                      if (!started.ok) {
                        alert(`Could not connect: ${started.error}`);
                        return;
                      }
                      const opening = started.opening.trim();
                      setMessages(opening ? [{ role: "ai", text: opening }] : []);
                      if (opening) {
                        setInterviewerSubtitle(opening);
                        const a = avatarRef.current;
                        if (a) {
                          try {
                            await a.repeat(opening);
                          } catch (e) {
                            console.error(e);
                          }
                        }
                      }
                    })()
                  }
                  className="rounded-lg border border-amber-600/60 bg-amber-950/90 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-900/90"
                >
                  Retry technical engine
                </button>
              </div>
            )}
          {sessionActive &&
            interviewMode === "technical" &&
            codingBrain.awaitingExplanation &&
            !technicalCodingActive && (
              <div className="absolute bottom-20 left-3 right-3 z-20 mx-auto max-w-lg rounded-lg border border-sky-500/35 bg-sky-950/90 px-3 py-2 text-center text-xs text-sky-100 sm:bottom-24">
                Walk through your solution in your own words — then continue with Send.
              </div>
            )}
        </div>

        {technicalCodingActive && codingBrain.codingPrompt ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-white/10 bg-neutral-950 p-3 lg:min-h-[min(480px,70vh)] lg:border-t-0 lg:border-l lg:border-white/10 lg:p-4">
            <CodingProblemPanel problem={codingBrain.codingPrompt} />
            <CodeEditorPanel
              problem={codingBrain.codingPrompt}
              disabled={isChatting || !codingBrain.brainReady || codingBrain.isStartingBrain}
              onSubmit={(code, lang, summary) => void sendCodeSubmission(code, lang, summary)}
              testResults={codingBrain.testResults}
            />
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-xs text-neutral-500 sm:text-left">
                Submit from the editor when ready, or end the practice — you’ll hear a short closing message.
              </p>
              <button
                type="button"
                onClick={() => void handleCodingGiveUp()}
                disabled={isChatting || !codingBrain.brainReady || codingBrain.isStartingBrain}
                className="shrink-0 rounded-lg border border-white/20 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                End session (give up)
              </button>
            </div>
          </div>
        ) : null}
        </div>

        {sessionActive && cameraOn && (
          <div
            className="pointer-events-auto absolute z-[35] overflow-hidden rounded-lg border-2 border-white/90 shadow-2xl"
            style={{
              width: pipWidth,
              right: 16,
              bottom: 88,
              transform: `translate(${pipTranslate.x}px, ${pipTranslate.y}px)`,
              transformOrigin: "bottom right",
            }}
          >
            <div
              className="flex h-6 cursor-grab touch-none items-center justify-center rounded-t-md bg-black/65 active:cursor-grabbing"
              aria-label="Drag camera preview"
              onPointerDown={(e) => {
                e.preventDefault();
                pipMoveDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  tx: pipTranslate.x,
                  ty: pipTranslate.y,
                };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = pipMoveDragRef.current;
                if (!d) return;
                const nx = d.tx + (e.clientX - d.startX);
                const ny = d.ty + (e.clientY - d.startY);
                setPipTranslate(clampPipTranslate(nx, ny));
              }}
              onPointerUp={(e) => {
                pipMoveDragRef.current = null;
                setPipTranslate((cur) => {
                  try {
                    localStorage.setItem(PIP_TRANSLATE_STORAGE, JSON.stringify(cur));
                  } catch {
                    /* ignore */
                  }
                  return cur;
                });
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
              }}
              onPointerCancel={(e) => {
                pipMoveDragRef.current = null;
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
              }}
            >
              <span className="select-none text-[11px] tracking-wide text-white/75">⋮⋮ drag</span>
            </div>
            <div className="relative aspect-video w-full">
              <video
                ref={userVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
              <canvas ref={bodyLanguage.canvasRef} className="hidden" aria-hidden />
              <span className="pointer-events-none absolute left-2 top-8 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                You
              </span>
              <BodyLanguagePipHud motionScore={bodyLanguage.motionScore} warnings={bodyLanguage.warnings} />
              <div
                data-pip-resize
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
                  const delta = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : step;
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

        {sessionActive && (
          <div className="pointer-events-none relative z-40 flex shrink-0 justify-center border-t border-white/10 bg-neutral-950/98 px-2 py-2 backdrop-blur-md">
            <div
              className="pointer-events-auto flex max-w-full flex-col items-center gap-1"
              style={{
                transform: `translate(${toolbarTranslate.x}px, ${toolbarTranslate.y}px)`,
              }}
            >
              <div
                className="flex h-5 w-full max-w-xs cursor-grab touch-none items-center justify-center rounded-md bg-white/10 active:cursor-grabbing"
                aria-label="Drag meeting controls"
                onPointerDown={(e) => {
                  e.preventDefault();
                  toolbarMoveDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    tx: toolbarTranslate.x,
                    ty: toolbarTranslate.y,
                  };
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = toolbarMoveDragRef.current;
                  if (!d) return;
                  const nx = d.tx + (e.clientX - d.startX);
                  const ny = d.ty + (e.clientY - d.startY);
                  setToolbarTranslate(clampToolbarTranslate(nx, ny));
                }}
                onPointerUp={(e) => {
                  toolbarMoveDragRef.current = null;
                  setToolbarTranslate((cur) => {
                    try {
                      localStorage.setItem(TOOLBAR_TRANSLATE_STORAGE, JSON.stringify(cur));
                    } catch {
                      /* ignore */
                    }
                    return cur;
                  });
                  try {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
                onPointerCancel={(e) => {
                  toolbarMoveDragRef.current = null;
                  try {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <span className="select-none text-[10px] text-white/50">⋮⋮ drag toolbar</span>
              </div>
              <div
                className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-neutral-900/95 px-3 py-2 shadow-xl backdrop-blur-md sm:gap-3 sm:px-5"
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
                  onKeyDown={(e) => e.key === "Enter" && !sendDisabled && void sendMessage()}
                  disabled={sendDisabled}
                  tabIndex={-1}
                  className="sr-only"
                  aria-label="Your answer — shown as captions at the top; use the keyboard button or microphone"
                />

                <button
                  type="button"
                  onClick={() => answerInputRef.current?.focus()}
                  disabled={sendDisabled}
                  title="Type with keyboard (captions at top)"
                  aria-label="Type with keyboard"
                  className={clsx(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-neutral-800/90 text-white transition-colors hover:bg-neutral-700",
                    sendDisabled && "cursor-not-allowed opacity-40"
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
                  disabled={sendDisabled}
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
                  onClick={() => void handleLeaveMeeting()}
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
          </div>
        )}
      </div>

      {isLiveInterview ? (
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
        <div className="rounded-xl border border-cyan-800/80 bg-neutral-900 p-4 dark:border-cyan-800">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-400">Company Monitor</h3>
          <p className="mb-2 text-xs text-neutral-400">Share with interviewer:</p>
          <div className="mb-2 break-all font-mono text-xs text-cyan-300">{monitorUrl || "…"}</div>
          <button
            type="button"
            onClick={() => {
              if (!monitorUrl) return;
              void navigator.clipboard.writeText(monitorUrl);
              setMonitorCopied(true);
              window.setTimeout(() => setMonitorCopied(false), 2000);
            }}
            className="w-full rounded px-3 py-1.5 text-xs text-white transition-colors bg-cyan-800 hover:bg-cyan-700"
          >
            {monitorCopied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">TrueFace AI</h3>
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-xs",
                mlConnected ? "bg-green-900 text-green-400" : "bg-neutral-800 text-neutral-500"
              )}
            >
              {mlConnected ? "● LIVE" : "● OFFLINE"}
            </span>
          </div>
          {mlScores ? (
            <>
              <div className="mb-3 rounded-lg bg-neutral-800 py-3 text-center">
                <div className="text-4xl font-bold text-white">{Math.round((1 - mlScores.final_score) * 100)}%</div>
                <div className="mt-1 text-xs text-neutral-400">Authenticity</div>
                <div className={clsx("mt-1 text-xs font-bold", getRiskColor(mlScores.risk_level))}>
                  {mlScores.risk_level}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {Object.entries(mlScores.signal_breakdown).map(([key, val]) => (
                  <div key={key}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="capitalize text-neutral-400">{key.replace(/_/g, " ")}</span>
                      <span className="text-neutral-500">{val.label}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-neutral-800">
                      <div
                        className={clsx("h-1.5 rounded-full transition-all duration-700", getBarColor(val.score))}
                        style={{ width: `${val.score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-xs text-neutral-500">
              {mlConnected ? "Analyzing…" : "Start interview to begin"}
            </div>
          )}
        </div>
      </aside>
      ) : null}
      </div>
    </div>
  );
}
