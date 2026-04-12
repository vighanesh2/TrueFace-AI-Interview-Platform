"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  lightDescription,
  lightFieldsetPanel,
  lightPrimaryButton,
  lightSecondaryButton,
} from "@/lib/dashboard-light-theme";

/** Clipboard API can fail (non-HTTPS, permissions); fall back to execCommand. */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const fieldClass = clsx(
  "mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm transition-colors",
  "border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400",
  "dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-100 dark:placeholder:text-neutral-500",
  "focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/10",
  "dark:focus:border-neutral-500 dark:focus:ring-white/15"
);

const labelClass =
  "block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400";

/** Native `<button>` / `<a>` — theme tokens use Headless `data-hover`; add CSS :hover for parity. */
const secondaryBtnNative = clsx(
  lightSecondaryButton,
  "hover:bg-neutral-50 dark:hover:bg-neutral-700"
);

const primaryBtnNative = clsx(
  lightPrimaryButton,
  "hover:bg-neutral-800 dark:hover:bg-white"
);

/** Denser layout for the “session created” screen so it fits common laptop viewports. */
const successShell = "mx-auto max-w-2xl px-5 py-6 sm:px-8 sm:py-8";
const successCardClass = clsx(
  "space-y-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm",
  "dark:border-neutral-700 dark:bg-neutral-900/50 dark:shadow-neutral-950/40"
);
const successBtnClass = clsx(secondaryBtnNative, "!py-2 !px-3 !text-xs");

export default function CreateLiveInterviewPage() {
  const [candidateName, setCandidateName] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState<"behavioral" | "technical">("behavioral");
  const [created, setCreated] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [recordingId, setRecordingId] = useState("");
  const [liveBumpToken, setLiveBumpToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [copiedCandidate, setCopiedCandidate] = useState(false);
  const [copiedMonitor, setCopiedMonitor] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const candidateUrl = useMemo(() => {
    if (!sessionId) return "";
    const q = new URLSearchParams();
    if (recordingId) q.set("recording", recordingId);
    if (liveBumpToken) q.set("t", liveBumpToken);
    q.set("type", interviewType);
    const qs = q.toString();
    return `${origin}/live-interview/${sessionId}${qs ? `?${qs}` : ""}`;
  }, [sessionId, recordingId, liveBumpToken, interviewType, origin]);

  const monitorUrl = useMemo(
    () => (sessionId ? `${origin}/monitor/candidate_${sessionId}` : ""),
    [sessionId, origin]
  );

  async function handleCopyCandidate() {
    const ok = await copyTextToClipboard(candidateUrl);
    if (!ok) return;
    setCopiedCandidate(true);
    window.setTimeout(() => setCopiedCandidate(false), 2000);
  }

  async function handleCopyMonitor() {
    const ok = await copyTextToClipboard(monitorUrl);
    if (!ok) return;
    setCopiedMonitor(true);
    window.setTimeout(() => setCopiedMonitor(false), 2000);
  }

  const createSession = async () => {
    setCreateError("");
    const id = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCreating(true);
    try {
      const res = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: interviewType,
          liveSessionId: id,
          candidateName,
          role,
          jobDescription,
        }),
      });
      const data = (await res.json()) as { id?: string; liveBumpToken?: string; error?: string };
      if (!res.ok) {
        setCreateError(data.error || "Could not create session recording");
        return;
      }
      setSessionId(id);
      setRecordingId(data.id ?? "");
      setLiveBumpToken(data.liveBumpToken ?? "");
      setCreated(true);
    } catch {
      setCreateError("Network error — try again.");
    } finally {
      setCreating(false);
    }
  };

  const typeBtn = (active: boolean) =>
    clsx(
      "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
      active
        ? "border-neutral-800 bg-neutral-900 text-white shadow-sm dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900"
        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:bg-neutral-800/90"
    );

  if (created) {
    return (
      <div className={successShell}>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-[1.65rem]">
          Session created
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          Share the links below. Saved under{" "}
          <Link href="/dashboard/recordings" className="font-medium underline-offset-2 hover:underline">
            Recordings
          </Link>
          —message count updates as the candidate chats.
        </p>

        <div className={clsx(successCardClass, "mt-4 mb-3")}>
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Candidate link
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Send to {candidateName || "the candidate"}.
          </p>
          <a
            href={candidateUrl}
            className="block max-h-14 overflow-y-auto break-all font-mono text-[11px] leading-snug text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200"
          >
            {candidateUrl}
          </a>
          <button
            type="button"
            onClick={() => void handleCopyCandidate()}
            className={successBtnClass}
          >
            {copiedCandidate ? "Copied" : "Copy candidate link"}
          </button>
        </div>

        <div className={clsx(successCardClass, "mb-3")}>
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Company monitor
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">Watch the session live.</p>
          <a
            href={monitorUrl}
            className="block break-all font-mono text-[11px] leading-snug text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200"
          >
            {monitorUrl}
          </a>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => void handleCopyMonitor()} className={successBtnClass}>
              {copiedMonitor ? "Copied" : "Copy monitor link"}
            </button>
            <button
              type="button"
              onClick={() => {
                const w = window.open(monitorUrl, "_blank");
                if (w) w.opener = null;
              }}
              className={successBtnClass}
            >
              Open monitor →
            </button>
          </div>
        </div>

        <div className={clsx(successCardClass, "mb-4")}>
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Session details
          </h2>
          <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-neutral-700 dark:text-neutral-300 sm:grid-cols-2">
            <div>
              <span className="text-neutral-500">Candidate:</span> {candidateName || "—"}
            </div>
            <div>
              <span className="text-neutral-500">Role:</span> {role || "—"}
            </div>
            <div>
              <span className="text-neutral-500">Type:</span> {interviewType}
            </div>
            <div className="sm:col-span-2">
              <span className="text-neutral-500">Session:</span>{" "}
              <span className="font-mono text-[11px]">{sessionId}</span>
            </div>
            {recordingId ? (
              <div className="sm:col-span-2">
                <span className="text-neutral-500">Recording:</span>{" "}
                <Link
                  href="/dashboard/recordings"
                  className="font-mono text-[11px] underline-offset-2 hover:underline"
                >
                  {recordingId.slice(0, 8)}…
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreated(false);
            setSessionId("");
            setRecordingId("");
            setLiveBumpToken("");
          }}
          className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Create another session
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12 sm:px-10 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Create live interview</h1>
      <p className={clsx(lightDescription, "mt-2 mb-8")}>
        Set up a verified interview session. You&apos;ll get a candidate link and a live monitor link.
      </p>

      <div className={clsx(lightFieldsetPanel, "space-y-5")}>
        <div>
          <label className={labelClass} htmlFor="live-candidate-name">
            Candidate name
          </label>
          <input
            id="live-candidate-name"
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="e.g. John Smith"
            className={fieldClass}
            autoComplete="name"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="live-role">
            Role
          </label>
          <input
            id="live-role"
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Software Engineering Intern"
            className={fieldClass}
          />
        </div>

        <div>
          <span className={labelClass}>Interview type</span>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => setInterviewType("behavioral")} className={typeBtn(interviewType === "behavioral")}>
              Behavioral
            </button>
            <button type="button" onClick={() => setInterviewType("technical")} className={typeBtn(interviewType === "technical")}>
              Technical
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="live-jd">
            Job description <span className="font-normal normal-case text-neutral-400 dark:text-neutral-500">(optional)</span>
          </label>
          <textarea
            id="live-jd"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste job description here…"
            rows={4}
            className={clsx(fieldClass, "resize-y")}
          />
        </div>

        {createError ? <p className="text-sm text-red-600 dark:text-red-400">{createError}</p> : null}
        <button
          type="button"
          onClick={() => void createSession()}
          disabled={creating}
          className={clsx(primaryBtnNative, "w-full justify-center py-3", creating && "opacity-60")}
        >
          {creating ? "Creating…" : "Create interview session →"}
        </button>
      </div>
    </div>
  );
}
