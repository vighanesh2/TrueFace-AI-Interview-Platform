"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { lightFieldsetPanel } from "@/lib/dashboard-light-theme";
import { NewInterviewLauncher } from "./new-interview-launcher";

type RecordingRow = {
  id: string;
  type: "technical" | "behavioral";
  title: string;
  status: string;
  messageCount: number;
  source?: "text_chat" | "live_avatar";
  createdAt: string;
  updatedAt: string;
  meetingVideoUrl: string | null;
};

function recordingHref(r: RecordingRow): string {
  if (r.source === "live_avatar") {
    return `/dashboard/recording/${r.id}`;
  }
  return `/interview/${r.id}`;
}

export function RecordingsClient() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recordings");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setRecordings(data.recordings ?? []);
    } catch {
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10 sm:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Recordings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
            What you&apos;ve practiced
          </h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
            Open a session to continue, or start a new technical or behavioral interview.
          </p>
        </div>
        <NewInterviewLauncher className="shrink-0" />
      </header>

      <section className="mt-10 space-y-4">
        {loading ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading recordings…</p>
        ) : recordings.length === 0 ? (
          <div className={clsx(lightFieldsetPanel, "text-center")}>
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">No recordings yet.</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Start a technical or behavioral session—it will appear here with type, status, and message counts.
            </p>
            <NewInterviewLauncher className="mx-auto mt-6 max-w-xs" />
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {recordings.map((r) => (
              <li key={r.id}>
                <div className="flex items-stretch gap-2 rounded-xl border border-neutral-200 bg-white shadow-sm transition-colors hover:border-neutral-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 sm:gap-0">
                  <Link
                    href={`/interview/${r.id}`}
                    className="flex min-w-0 flex-1 gap-4 p-4 transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40"
                  >
                    <div
                      className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800"
                      aria-hidden
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        {r.type}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{r.title}</h2>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {r.messageCount} messages · Updated {new Date(r.updatedAt).toLocaleString()}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                          {r.type === "technical" ? "Technical" : "Behavioral"}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium capitalize text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {r.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </Link>
                  {r.meetingVideoUrl ? (
                    <div className="flex shrink-0 items-center border-l border-neutral-200 px-3 dark:border-neutral-700 sm:px-4">
                      <a
                        href={r.meetingVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-emerald-100 px-3 py-1.5 text-center text-xs font-medium text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:hover:bg-emerald-900/55"
                      >
                        Watch video
                      </a>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
