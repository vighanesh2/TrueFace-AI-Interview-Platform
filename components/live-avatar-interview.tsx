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
<<<<<<< Updated upstream
=======
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const pipResizeDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const answerInputRef = useRef<HTMLInputElement | null>(null);

  // --- NEW: RECORDING STATE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [canSaveRecording, setCanSaveRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // --- NEW: RECORDING REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

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
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
=======
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
        audio: true,
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

  // --- NEW: VIDEO RECORDING FUNCTIONS ---
  const startRecording = () => {
    if (!userStreamRef.current) {
      alert("Please turn your camera on first to record your response!");
      return;
    }
    
    recordedChunksRef.current = [];
    const stream = userStreamRef.current;
    
    // Create the recorder
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const finalBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      setRecordedBlob(finalBlob);
      setCanSaveRecording(true); // Triggers the overlay popup
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);

    // 2-MINUTE LIMIT TIMER (120,000 milliseconds)
    recordingTimerRef.current = setTimeout(() => {
        stopRecording();
        alert("2-minute recording limit reached.");
    }, 120000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
          clearTimeout(recordingTimerRef.current);
      }
    }
  };

  const saveRecording = async () => {
    if (!recordedBlob) return;
    setIsSaving(true);

    try {
      // 1. Upload to Vercel Blob (This is already working beautifully!)
      const filename = `clip-${Date.now()}.webm`;
      const uploadRes = await fetch(`/api/recordings/upload?filename=${filename}`, {
        method: "POST",
        body: recordedBlob,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();

      // 2. Save metadata to MongoDB using our new Smart Route!
      const questionText = interviewerSubtitle || "Interview Response";

      const dbRes = await fetch(`/api/recordings/save-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: uploadData.url,
          question: questionText,
        }),
      });

      if (!dbRes.ok) throw new Error("Database update failed");
      console.log("✅ Video clip successfully saved to MongoDB!");
    } catch (error) {
      console.error(error);
      alert("Failed to save recording metadata.");
    } finally {
      setIsSaving(false);
      setRecordedBlob(null);
      setCanSaveRecording(false);
    }
  };

>>>>>>> Stashed changes
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
    // Prevent sending if empty or already waiting for a response
    if (!input.trim() || isChatting) return;

<<<<<<< Updated upstream
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
=======
    // Stop the microphone automatically when they hit send
    if (isListening) {
      recognitionRef.current?.stop();
>>>>>>> Stashed changes
      setIsListening(false);
    }

    const userText = input;
    setInput("");
    
    // Update the UI immediately with the user's new message
    const currentMessages = [...messages, { role: "user", text: userText }];
    setMessages(currentMessages);
    setIsChatting(true); // Fix: Using isChatting instead of setIsLoading

    try {
<<<<<<< Updated upstream
      const formattedHistory = currentMessages.map((msg) => ({
=======
      // 🚨 FIX: Pass ONLY the past history to Gemini, excluding the message we just added
      const formattedHistory = messages.map((msg) => ({
>>>>>>> Stashed changes
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
<<<<<<< Updated upstream
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
=======
        body: JSON.stringify({ 
          message: userText,
          history: formattedHistory,
        }),
      });
      
      // Handle unauthorized kicks to login
      if (chatRes.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
>>>>>>> Stashed changes

      const chatData = await chatRes.json();
      
      if (!chatRes.ok || !chatData.response) {
         throw new Error(chatData.error || "Gemini API failed to respond");
      }

      const aiResponse = chatData.response;

      // Update UI with the AI's response
      setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);

      // Make the Avatar speak!
      if (avatarRef.current) {
        try {
           console.log("Sending text to avatar...");
           await avatarRef.current.repeat(aiResponse);
        } catch (sdkError) {
           console.error("Failed to make avatar repeat:", sdkError);
        }
      } else {
         console.error("Critical SDK Error: Avatar reference is missing.");
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      // Revert UI so user can try again without breaking history
      setMessages(messages); 
      alert("Failed to send message. The API might be busy—wait a few seconds and try again.");
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
      {/* --- NEW OVERLAY: SAVE VIDEO CLIP --- */}
      {canSaveRecording && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-[100] p-8">
          <p className="text-2xl font-bold text-white mb-2">Response Captured 🎥</p>
          <p className="text-neutral-400 max-w-md text-center mb-4">Would you like to save the video clip of your last response to your dashboard for review?</p>
          
          <div className="flex gap-4">
            <Button type="button" onClick={saveRecording} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform hover:scale-105">
              {isSaving ? 'Saving to Cloud...' : 'Save Video Clip'}
            </Button>
            <Button type="button" onClick={() => { setRecordedBlob(null); setCanSaveRecording(false); }} disabled={isSaving} className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white font-bold py-3 px-8 rounded-lg transition-colors">
              Discard
            </Button>
          </div>
        </div>
      )}

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

<<<<<<< Updated upstream
          <Button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!sessionActive || isChatting}
            className={clsx(lightPrimaryButton, "shrink-0 sm:px-8")}
          >
            {isChatting ? "Thinking…" : "Send"}
          </Button>
=======
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

                {/* --- NEW: RECORD BUTTON --- */}
                <ZoomControlButton
                  active={isRecording}
                  label={isRecording ? "Stop Recording" : "Record Answer (2m limit)"}
                  onClick={() => isRecording ? stopRecording() : startRecording()}
                  disabled={!cameraOn}
                  danger={isRecording} // Makes it pulse red when active!
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isRecording ? "currentColor" : "none"} aria-hidden>
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
                  </svg>
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
>>>>>>> Stashed changes
        </div>
      </div>
    </div>
  );
}
