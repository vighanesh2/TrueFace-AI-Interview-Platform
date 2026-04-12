"use client";

import { useEffect, useRef, useState } from "react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import { Button, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  
  // --- TEAMMATE STATE ---
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ending, setEnding] = useState(false);

  // --- YOUR AVATAR & AUDIO STATE ---
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [fillerCount, setFillerCount] = useState(0);
  
  // --- BODY LANGUAGE STATE ---
  const [userVideoActive, setUserVideoActive] = useState(false);
  const [motionScore, setMotionScore] = useState(0);
  const [isFidgeting, setIsFidgeting] = useState(false);

  // --- REFS ---
  const recognitionRef = useRef<any>(null);
  const avatarRef = useRef<any>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const interimFillerCountRef = useRef(0);
  
  // Body Language Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousImageData = useRef<Uint8ClampedArray | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // --- INITIALIZE BROWSER SPEECH RECOGNITION & FILLER WORD TRACKER ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true; 
        recognition.interimResults = true; 
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          let isFinalResult = false;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              isFinalResult = true;
            }
          }
          
          setInput(currentTranscript);

          const fillers = currentTranscript.match(/\b(um|uh|uhm|like|Ah|basically|literally)\b/gi);
          const currentFillerAmount = fillers ? fillers.length : 0;

          if (currentFillerAmount > interimFillerCountRef.current) {
            const difference = currentFillerAmount - interimFillerCountRef.current;
            setFillerCount(prev => prev + difference);
            interimFillerCountRef.current = currentFillerAmount;
          }

          if (isFinalResult) {
            interimFillerCountRef.current = 0;
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // --- BODY LANGUAGE MATH ENGINE ---
  const analyzeFrame = () => {
    if (!userVideoRef.current || !canvasRef.current || !userVideoActive) return;

    const video = userVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    
    if (!ctx || video.videoWidth === 0) {
      animationFrameId.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    if (canvas.width !== 64) {
      canvas.width = 64;
      canvas.height = 48;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const currentData = currentFrame.data;

    if (previousImageData.current) {
      let diffCount = 0;
      const totalPixels = currentData.length / 4;

      for (let i = 0; i < currentData.length; i += 4) {
        const rDiff = Math.abs(currentData[i] - previousImageData.current[i]);
        const gDiff = Math.abs(currentData[i + 1] - previousImageData.current[i + 1]);
        const bDiff = Math.abs(currentData[i + 2] - previousImageData.current[i + 2]);
        
        if (rDiff + gDiff + bDiff > 50) {
          diffCount++;
        }
      }

      const currentMotion = Math.min(100, Math.round((diffCount / totalPixels) * 250));
      setMotionScore(prev => {
        const newScore = Math.round(prev * 0.8 + currentMotion * 0.2);
        setIsFidgeting(newScore > 40);
        return newScore;
      });
    }

    previousImageData.current = new Uint8ClampedArray(currentData);
    
    setTimeout(() => {
      animationFrameId.current = requestAnimationFrame(analyzeFrame);
    }, 1000 / 30); 
  };

  useEffect(() => {
    if (userVideoActive) {
      animationFrameId.current = requestAnimationFrame(analyzeFrame);
    } else {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [userVideoActive]);


  // --- COMPONENT CLEANUP ---
  useEffect(() => {
    return () => {
      if (avatarRef.current && typeof avatarRef.current.stop === 'function') {
        avatarRef.current.stop().catch(console.error);
      }
      if (userVideoRef.current && userVideoRef.current.srcObject) {
         const stream = userVideoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- CAMERA CONTROL ---
  const startUserCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        setUserVideoActive(true);
      }
    } catch (err) {
      console.error("Failed to access webcam:", err);
      alert("Please allow webcam access to analyze your body language.");
    }
  };

  // --- MICROPHONE CONTROL ---
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput(""); 
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // --- AVATAR SESSION CONTROLS ---
  const stopAvatarSession = async () => {
    if (avatarRef.current && typeof avatarRef.current.stop === 'function') {
      try {
        await avatarRef.current.stop();
      } catch (e) {
        console.error("Error stopping avatar cleanly:", e);
      }
      avatarRef.current = null;
    }
    setSessionActive(false);
    setIsAvatarStarting(false);
    if (isListening) {
      recognitionRef.current?.stop();
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
        throw new Error("Token generation failed before session could start.");
      }

      const avatar = new LiveAvatarSession(tokenData.token);
      avatarRef.current = avatar;

      avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
        const videoElement = document.getElementById("avatar-video") as HTMLVideoElement;
        if (videoElement) {
          avatar.attach(videoElement);
          setSessionActive(true);
        }
      });

      avatar.on(SessionEvent.SESSION_DISCONNECTED, () => {
        stopAvatarSession();
      });

      await avatar.start();
    } catch (error) {
      console.error("Failed to start avatar:", error);
      await stopAvatarSession();
    } finally {
      setIsAvatarStarting(false);
    }
  };

  // --- TEAMMATE's DB CLEANUP + YOUR AVATAR CLEANUP ---
  const endSession = async () => {
    setEnding(true);
    await stopAvatarSession();
    
    if (userVideoRef.current && userVideoRef.current.srcObject) {
       const stream = userVideoRef.current.srcObject as MediaStream;
       stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);

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

  const logout = async () => {
    await stopAvatarSession();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // --- SEND MESSAGE (COMBINED PIPELINE) ---
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

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
      
      const aiResponse = data.response;
      setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);

      if (avatarRef.current) {
        if (typeof avatarRef.current.speak === 'function') {
           await avatarRef.current.speak({ text: aiResponse });
        } else if (typeof avatarRef.current.sendText === 'function') {
           await avatarRef.current.sendText(aiResponse);
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const typeLabel = interviewType === "technical" ? "Technical" : "Behavioral";

  return (
    <main className="dark flex min-h-screen flex-col items-center bg-gray-950 p-6 font-sans text-white sm:p-8">
      {/* HEADER */}
      <div className="w-full max-w-2xl flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0 flex-1">
          <Link href="/dashboard/recordings" className="text-sm/6 font-medium text-white/55 hover:text-white underline-offset-2 hover:underline">
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
          <Button type="button" onClick={logout} className={subtleButtonClass}>
            Sign out
          </Button>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{typeLabel} session</p>
      <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight text-center max-w-2xl mt-1">
        {recordingTitle}
      </h1>
      <p className="text-sm/6 text-white/50 mb-8">Your AI interviewer is ready.</p>

      {/* --- VIDEO UI CONTAINER --- */}
      <div className="w-full max-w-2xl aspect-video bg-gray-900 border border-white/10 rounded-xl overflow-hidden mb-6 relative flex items-center justify-center shadow-2xl">
        
        <video 
          id="avatar-video"
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover scale-110 translate-y-4 ${sessionActive ? 'block' : 'hidden'}`}
        >
          <track kind="captions" />
        </video>

        {/* --- LIVE METRICS DASHBOARD --- */}
        {sessionActive && (
          <div className="absolute top-4 left-4 bg-gray-950/80 backdrop-blur-sm border border-white/10 p-3 rounded-lg z-20 transition-all">
            <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">Live Metrics</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🗣️</span>
                <p className="text-sm text-white">Fillers: <span className={fillerCount > 5 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{fillerCount}</span></p>
              </div>
              <div className="w-px h-4 bg-white/20"></div>
              <div className="flex items-center gap-2">
                <span className="text-lg">👀</span>
                <p className="text-sm text-white">Motion: <span className={isFidgeting ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{motionScore}%</span></p>
              </div>
            </div>
          </div>
        )}

        {/* User Local Camera */}
        <div className="absolute bottom-4 right-4 w-32 sm:w-48 aspect-video bg-black rounded-lg overflow-hidden border border-white/10 shadow-xl z-20 group">
          <button 
            onClick={startUserCamera}
            className={`w-full h-full flex flex-col items-center justify-center bg-gray-800 hover:bg-gray-700 text-xs text-white/70 font-bold transition-colors ${userVideoActive ? 'hidden' : 'flex'}`}
          >
            <span className="text-xl mb-1">📷</span>
            Enable Camera
          </button>
          
          <video 
            ref={userVideoRef}
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transform -scale-x-100 ${userVideoActive ? 'block' : 'hidden'}`} 
          />
          {/* Hidden Canvas for Body Language Math */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {!sessionActive && (
          <div className="absolute z-10 flex flex-col items-center gap-4">
            <p className="text-white/40">Video feed offline.</p>
            <Button 
              onClick={startAvatarSession}
              disabled={isAvatarStarting}
              className={primaryButtonClass}
            >
              {isAvatarStarting ? "Booting up Avatar..." : "Start Video Interview"}
            </Button>
          </div>
        )}
      </div>

      {/* CHAT HISTORY */}
      <Fieldset className={clsx(chatShell, "h-[min(400px,50vh)] mb-6")}>
        <Legend className={legendTitle}>Conversation</Legend>
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pr-1">
          {messages.length === 0 && (
            <p className="text-sm/6 text-white/40 text-center mt-16">Type or speak below to start your interview…</p>
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

      {/* INPUT AREA */}
      <Fieldset disabled={isLoading} className={clsx(chatShell, "space-y-5")}>
        <Legend className={legendTitle}>Your response</Legend>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          
          <div className="flex min-w-0 flex-1 gap-2 items-end">
            <Button
              type="button"
              onClick={toggleListening}
              disabled={!sessionActive || isLoading}
              className={`flex items-center justify-center h-[38px] w-[46px] rounded-lg transition-all duration-300 disabled:opacity-50 ${
                isListening ? "bg-red-500 hover:bg-red-400 animate-pulse shadow-lg shadow-red-500/20" : "bg-white/5 border border-white/10 hover:bg-white/10"
              }`}
              title={isListening ? "Stop Listening" : "Start Microphone"}
            >
              {isListening ? "🛑" : "🎙️"}
            </Button>

            <Field className="min-w-0 flex-1">
              <Label className={labelClass}>Message</Label>
              <Input
                type="text"
                name="message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type or speak your answer…"
                className={inputClass}
              />
            </Field>
          </div>

          <Button
            type="button"
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !isListening)}
            className={clsx(primaryButtonClass, "mt-1 sm:mt-0 sm:w-auto sm:shrink-0 sm:px-8")}
          >
            Send
          </Button>
        </div>
      </Fieldset>
    </main>
  );
}