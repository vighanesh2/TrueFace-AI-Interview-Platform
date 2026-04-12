"use client";

import { Button, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { inputClass, labelClass, legendTitle, primaryButtonClass, subtleButtonClass } from "@/lib/fieldset-theme";
import type { InterviewType } from "@/lib/recordings";

type Props = {
  userEmail: string;
  recordingId: string;
  interviewType: InterviewType;
  recordingTitle: string;
};

const chatShell = clsx(
  "w-full max-w-2xl space-y-4 rounded-xl bg-white/5 p-6 sm:p-8",
  "border border-white/10 flex flex-col min-h-0"
);

const messageBubble = (role: string) =>
  clsx(
    "p-4 rounded-lg max-w-[85%] sm:max-w-[80%] text-sm/6",
    role === "user" ? "bg-gray-600/35 text-white self-end border border-white/10" : "bg-white/5 text-white/95 self-start border border-white/10"
  );

export default function InterviewChat({ userEmail, recordingId, interviewType, recordingTitle }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ending, setEnding] = useState(false);

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

  const sendMessage = async () => {
    if (!input.trim()) return;

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
      setMessages((prev) => [...prev, { role: "ai", text: data.response }]);
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const typeLabel = interviewType === "technical" ? "Technical" : "Behavioral";

  return (
    <main className="dark flex min-h-screen flex-col items-center bg-gray-950 p-6 font-sans text-white sm:p-8">
      <div className="w-full max-w-2xl flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0 flex-1">
          <Link
            href="/dashboard/recordings"
            className="text-sm/6 font-medium text-white/55 hover:text-white underline-offset-2 hover:underline"
          >
            ← Recordings
          </Link>
          <p className="text-sm/6 text-white/50 truncate mt-1" title={userEmail}>
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
      <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight text-center max-w-2xl mt-1">
        {recordingTitle}
      </h1>
      <p className="text-sm/6 text-white/50 mb-8">Your AI interviewer is ready.</p>

      <Fieldset className={clsx(chatShell, "h-[min(520px,65vh)] mb-6")}>
        <Legend className={legendTitle}>Conversation</Legend>
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pr-1">
          {messages.length === 0 && (
            <p className="text-sm/6 text-white/40 text-center mt-16">Type below to start your interview…</p>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={messageBubble(msg.role)}>
              <span className="font-semibold text-xs uppercase tracking-wide text-white/45 block mb-1.5">
                {msg.role === "user" ? "You" : "Interviewer"}
              </span>
              {msg.text}
            </div>
          ))}
          {isLoading && <p className="text-sm/6 text-white/40 self-start animate-pulse">Interviewer is typing…</p>}
        </div>
      </Fieldset>

      <Fieldset disabled={isLoading} className={clsx(chatShell, "space-y-5")}>
        <Legend className={legendTitle}>Your response</Legend>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field className="min-w-0 flex-1">
            <Label className={labelClass}>Message</Label>
            <Input
              type="text"
              name="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Type your answer…"
              className={inputClass}
            />
          </Field>
          <Button
            type="button"
            onClick={sendMessage}
            disabled={isLoading}
            className={clsx(primaryButtonClass, "mt-1 sm:mt-0 sm:w-auto sm:shrink-0 sm:px-8")}
          >
            Send
          </Button>
        </div>
      </Fieldset>
    </main>
  );
}
