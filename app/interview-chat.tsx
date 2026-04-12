"use client";

import { Button } from "@headlessui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { subtleButtonClass } from "@/lib/fieldset-theme";
import type { InterviewType } from "@/lib/recordings";

type Props = {
  userEmail: string;
  recordingId: string;
  interviewType: InterviewType;
  recordingTitle: string;
  /** Public URL from Vercel Blob when a mock-interview video was saved for this recording */
  meetingVideoUrl: string | null;
};

export default function InterviewChat({
  userEmail,
  recordingId,
  interviewType,
  recordingTitle,
  meetingVideoUrl: meetingVideoUrlProp,
}: Props) {
  const router = useRouter();
  const [meetingVideoUrl, setMeetingVideoUrl] = useState<string | null>(meetingVideoUrlProp);
  const [ending, setEnding] = useState(false);

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

  const endSession = async () => {
    setEnding(true);
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

  const typeLabel = interviewType === "technical" ? "Technical" : "Behavioral";

  return (
    <main className="dark flex min-h-screen flex-col items-center bg-gray-950 p-6 font-sans text-white sm:p-8">
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

      {meetingVideoUrl ? (
        <section
          className="mb-6 mt-8 w-full max-w-2xl rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4 sm:p-5"
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
      ) : (
        <p className="mt-8 max-w-md text-center text-sm/6 text-white/45">
          No video is linked to this recording yet. Record from the mock interview page to attach one.
        </p>
      )}
    </main>
  );
}
