"use client";

import { Button, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { inputClass, labelClass, legendTitle, primaryButtonClass, subtleButtonClass } from "@/lib/fieldset-theme";

type Props = { userEmail: string };

const chatShell = clsx(
  "w-full max-w-2xl space-y-4 rounded-xl bg-white/5 p-6 sm:p-8",
  "border border-white/10 flex flex-col min-h-0"
);

const messageBubble = (role: string) =>
  clsx(
    "p-4 rounded-lg max-w-[85%] sm:max-w-[80%] text-sm/6",
    role === "user" ? "bg-gray-600/35 text-white self-end border border-white/10" : "bg-white/5 text-white/95 self-start border border-white/10"
  );

export default function InterviewChat({ userEmail }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
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
        body: JSON.stringify({ message: input, history: newMessages }),
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

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-8 bg-gray-950 text-white font-sans">
      <div className="w-full max-w-2xl flex items-center justify-between gap-4 mb-6">
        <p className="text-sm/6 text-white/50 truncate" title={userEmail}>
          {userEmail}
        </p>
        <Button type="button" onClick={logout} className={subtleButtonClass}>
          Sign out
        </Button>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Mock Live</h1>
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
          {isLoading && (
            <p className="text-sm/6 text-white/40 self-start animate-pulse">Interviewer is typing…</p>
          )}
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
