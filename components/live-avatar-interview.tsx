"use client";

import { Button } from "@headlessui/react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  lightInput,
  lightPrimaryButton,
  lightSecondaryButton,
} from "@/lib/dashboard-light-theme";

export function LiveAvatarInterview() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null);
  const avatarRef = useRef<LiveAvatarSession | null>(null);

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

  const stopAvatarSession = async () => {
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
      const tokenRes = await fetch("/api/get-access-token", { method: "POST" });
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

  const shell = clsx(
    "rounded-xl border border-neutral-200 bg-white shadow-sm",
    "dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-neutral-950/40"
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
          Technical mock interview
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Live AI interviewer with video avatar. Start the session when you&apos;re ready, then answer by typing or using
          the microphone (Chrome recommended).
        </p>
      </div>

      <div
        className={clsx(
          shell,
          "relative flex aspect-video w-full max-w-4xl items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-950"
        )}
      >
        <video
          id="avatar-video"
          autoPlay
          playsInline
          className={clsx("h-full w-full object-cover", sessionActive ? "block" : "hidden")}
        >
          <track kind="captions" />
        </video>

        {!sessionActive && (
          <div className="absolute z-10 flex flex-col items-center gap-4 px-4 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Video feed offline.</p>
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

        {sessionActive && (
          <Button
            type="button"
            onClick={() => void stopAvatarSession()}
            className={clsx(
              "absolute right-4 top-4 border border-red-300 bg-white/95 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm backdrop-blur-sm",
              "data-hover:bg-red-50 dark:border-red-900/60 dark:bg-neutral-900/95 dark:text-red-300 dark:data-hover:bg-red-950/40"
            )}
          >
            End session
          </Button>
        )}
      </div>

      <div className="max-w-4xl space-y-4">
        <div
          className={clsx(
            "flex max-h-52 min-h-[10rem] flex-col gap-2 overflow-y-auto p-4 sm:p-5",
            shell
          )}
        >
          {messages.length === 0 && (
            <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Conversation will appear here once you start.
            </p>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={clsx(
                "max-w-[85%] rounded-lg border px-3 py-2 sm:px-4 sm:py-2.5",
                msg.role === "user"
                  ? "self-end border-neutral-200 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800"
                  : "self-start border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/80"
              )}
            >
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {msg.role === "user" ? "You" : "Interviewer"}
              </span>
              <span className="text-sm leading-relaxed text-neutral-900 dark:text-neutral-100">{msg.text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <Button
            type="button"
            onClick={toggleListening}
            disabled={!sessionActive || isChatting || !recognitionRef.current}
            title={isListening ? "Stop microphone" : "Start microphone"}
            className={clsx(
              lightSecondaryButton,
              "shrink-0 px-4 sm:w-auto",
              isListening && "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
            )}
          >
            {isListening ? "Stop mic" : "Mic"}
          </Button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type or dictate your answer…"
            disabled={!sessionActive || isChatting}
            className={clsx(lightInput, "!mt-0 min-w-0 flex-1")}
          />

          <Button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!sessionActive || isChatting}
            className={clsx(lightPrimaryButton, "shrink-0 sm:px-8")}
          >
            {isChatting ? "Thinking…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
