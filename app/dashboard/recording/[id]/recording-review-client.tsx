"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { InterviewType } from "@/lib/recordings";
import { lightFieldsetPanel } from "@/lib/dashboard-light-theme";

type Message = { role: string; text: string };

type Props = { recordingId: string };

export function RecordingReviewClient({ recordingId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<InterviewType>("behavioral");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${recordingId}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setError("Recording not found.");
        return;
      }
      const data = (await res.json()) as {
        title?: string;
        type?: InterviewType;
        messages?: Message[];
        source?: string;
      };
      setTitle(data.title ?? "Recording");
      setType(data.type === "technical" ? "technical" : "behavioral");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      setError("Could not load recording.");
    } finally {
      setLoading(false);
    }
  }, [recordingId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const typeLabel = type === "technical" ? "Technical" : "Behavioral";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:px-8">
      <Link
        href="/dashboard/recordings"
        className="text-sm font-medium text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400"
      >
        ← Recordings
      </Link>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : error ? (
        <p className="mt-8 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : (
        <>
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Saved mock interview · {typeLabel}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Transcript from your Live Avatar session. A meeting video download was offered when you saved (browser
            recording).
          </p>

          <section className={clsx(lightFieldsetPanel, "mt-10 space-y-4")}>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Conversation</h2>
            {messages.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No messages in this recording.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {messages.map((msg, idx) => (
                  <li
                    key={idx}
                    className={clsx(
                      "rounded-lg border px-4 py-3 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "ml-4 border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800/50"
                        : "mr-4 border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-900"
                    )}
                  >
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {msg.role === "user" ? "You" : "Interviewer"}
                    </span>
                    <span className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">{msg.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
