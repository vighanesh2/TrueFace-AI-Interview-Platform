"use client";

import { useEffect, useRef, useState } from "react";
import {
  AgentEventsEnum,
  CommandEventsEnum,
  LiveAvatarSession,
  SessionDisconnectReason,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";

/** Same topic as `@heygen/liveavatar-web-sdk` LIVEKIT_COMMAND_CHANNEL_TOPIC. */
const LIVEKIT_AGENT_CONTROL_TOPIC = "agent-control";

/**
 * LITE sessions open a signaling WebSocket; the SDK routes all commands there first.
 * For text speak, the WebSocket handler throws "Not permitted in LITE mode", which
 * drops the session. Sending the same payload over LiveKit `publishData` matches
 * the SDK fallback when no WebSocket exists.
 */
function patchLiteModeTextOverLiveKit(avatar: LiveAvatarSession) {
  const session = avatar as any;
  const orig = session.sendCommandEvent as
    | ((cmd: { event_type?: string }) => void)
    | undefined;
  if (typeof orig !== "function") return;

  session.sendCommandEvent = (commandEvent: { event_type?: string }) => {
    const et = commandEvent?.event_type;
    const ws: WebSocket | null | undefined = session._sessionEventSocket;
    const wsOpen = Boolean(ws && ws.readyState === WebSocket.OPEN);
    const room = session.room as { state?: string; localParticipant?: any } | undefined;
    const useLiveKitForText =
      wsOpen &&
      room?.state === "connected" &&
      typeof room.localParticipant?.publishData === "function" &&
      (et === CommandEventsEnum.AVATAR_SPEAK_TEXT ||
        et === CommandEventsEnum.AVATAR_SPEAK_RESPONSE);

    if (useLiveKitForText) {
      const data = new TextEncoder().encode(JSON.stringify(commandEvent));
      room!.localParticipant.publishData(data, {
        reliable: true,
        topic: LIVEKIT_AGENT_CONTROL_TOPIC,
      });
      return;
    }
    return orig.call(session, commandEvent);
  };
}

/** Long lines still show fully in chat; this only caps what we send to the avatar engine. */
const MAX_AVATAR_SPEAK_CHARS = 8000;
/** If the SDK never emits SPEAK_ENDED (common with some LITE + LiveKit paths), don't block the UI for minutes. */
const AVATAR_SPEAK_END_TIMEOUT_MS = 12_000;

function textForAvatarSpeech(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (t.length <= MAX_AVATAR_SPEAK_CHARS) return t;
  return `${t.slice(0, MAX_AVATAR_SPEAK_CHARS).trimEnd()}… [Full reply is in the chat.]`;
}

const DEFAULT_KNOWLEDGE =
  "Computer science background preparing for software engineering interviews. Comfortable with data structures, algorithms, and basic system design.";

function interviewApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_INTERVIEW_API_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000"
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [knowledge, setKnowledge] = useState(DEFAULT_KNOWLEDGE);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [brainReady, setBrainReady] = useState(false);
  const [isStartingBrain, setIsStartingBrain] = useState(false);

  const avatarRef = useRef<LiveAvatarSession | null>(null);
  const interviewSessionIdRef = useRef<string | null>(null);
  const avatarKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Serialized so we never stack `repeat` / `speak` calls (can drop video or close the WS). */
  const avatarSpeakChainRef = useRef<Promise<void>>(Promise.resolve());

  const clearAvatarKeepAlive = () => {
    if (avatarKeepAliveRef.current != null) {
      clearInterval(avatarKeepAliveRef.current);
      avatarKeepAliveRef.current = null;
    }
  };

  const speakThroughAvatar = async (text: string) => {
    const payload = textForAvatarSpeech(text);
    if (!payload) return;

    avatarSpeakChainRef.current = avatarSpeakChainRef.current.then(async () => {
      const avatar = avatarRef.current;
      if (!avatar) return;
      // After WS closes, SDK state is DISCONNECTED and repeat() throws before our LiveKit patch runs.
      if (avatar.state !== SessionState.CONNECTED) {
        return;
      }

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          avatar.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, onEnded);
          clearTimeout(failsafe);
          resolve();
        };
        const onEnded = () => finish();
        const failsafe = setTimeout(finish, AVATAR_SPEAK_END_TIMEOUT_MS);
        avatar.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, onEnded);

        const run = async () => {
          try {
            if (avatar.state !== SessionState.CONNECTED) {
              finish();
              return;
            }
            if (typeof avatar.repeat === "function") {
              avatar.repeat(payload);
              return;
            }
            if (typeof avatar.message === "function") {
              avatar.message(payload);
              return;
            }
            const legacy = avatar as any;
            if (typeof legacy.speak === "function") {
              await Promise.resolve(legacy.speak({ text: payload }));
              finish();
              return;
            }
            if (typeof legacy.sendText === "function") {
              await Promise.resolve(legacy.sendText(payload));
              finish();
              return;
            }
            console.warn("No repeat/message/speak API on LiveAvatarSession");
            finish();
          } catch (e) {
            console.error("speakThroughAvatar:", e);
            finish();
          }
        };
        void run();
      });
    });

    await avatarSpeakChainRef.current;
  };

  const startInterviewBrain = async () => {
    const base = interviewApiBase();
    const k = knowledge.trim() || DEFAULT_KNOWLEDGE;
    setIsStartingBrain(true);
    setBrainReady(false);
    interviewSessionIdRef.current = null;
    let opening = "";
    try {
      const res = await fetch(`${base}/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge: k }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : JSON.stringify(data?.detail ?? data);
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const sessionId = data.session_id as string;
      opening = (data.response as string) || "";
      interviewSessionIdRef.current = sessionId;
      setBrainReady(true);
      setMessages((prev) => [...prev, { role: "ai", text: opening }]);
    } catch (e) {
      console.error("Interview brain start failed:", e);
      alert(
        `Could not reach the interview API at ${base}. Is the backend running? (${e instanceof Error ? e.message : String(e)})`
      );
    } finally {
      // Don't tie "Connecting…" to TTS — SPEAK_ENDED may never fire on LITE/LiveKit.
      setIsStartingBrain(false);
    }
    if (opening.trim()) {
      try {
        await speakThroughAvatar(opening);
      } catch (e) {
        console.error("Opening avatar speak failed:", e);
      }
    }
  };

  // 1. Start the Avatar Session
  const startAvatarSession = async () => {
    setIsAvatarStarting(true);
    clearAvatarKeepAlive();
    try {
      const tokenRes = await fetch("/api/get-access-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      
      if (!tokenData.token) throw new Error("Failed to get token");

      const avatar = new LiveAvatarSession(tokenData.token);
      avatarRef.current = avatar;
      patchLiteModeTextOverLiveKit(avatar);

      avatar.on(SessionEvent.SESSION_DISCONNECTED, (reason: SessionDisconnectReason) => {
        clearAvatarKeepAlive();
        if (reason !== SessionDisconnectReason.CLIENT_INITIATED) {
          console.warn("LiveAvatar disconnected:", reason);
        }
      });

    // 3. THE MAGIC ATTACHER (2026 SDK Method)
    avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
      console.log("🎥 Stream event triggered!");
      
      // Grab the raw HTML video element
      const videoElement = document.getElementById("avatar-video") as HTMLVideoElement;
      
      if (videoElement) {
        console.log("✅ Binding SDK directly to video element!");
        
        // THE FIX: Let the SDK handle the stream automatically!
        avatar.attach(videoElement);

        setSessionActive(true);
        clearAvatarKeepAlive();
        avatarKeepAliveRef.current = setInterval(() => {
          const a = avatarRef.current;
          if (a?.state === SessionState.CONNECTED) {
            void a.keepAlive().catch(() => {});
          }
        }, 45_000);

        void startInterviewBrain();
      } else {
        console.error("❌ Could not find the video player on the screen.");
      }
    });

      await avatar.start();

    } catch (error) {
      console.error("Failed to start avatar:", error);
      alert("Failed to start avatar. Check your browser console for exact details.");
    } finally {
      setIsAvatarStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isChatting || !brainReady) return;
    const sid = interviewSessionIdRef.current;
    if (!sid) return;

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsChatting(true);

    const base = interviewApiBase();
    let aiResponse = "";
    let done = false;
    try {
      const chatRes = await fetch(`${base}/session/${sid}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: userText }),
      });
      const chatData = await chatRes.json().catch(() => ({}));
      if (!chatRes.ok) {
        const detail =
          typeof chatData?.detail === "string"
            ? chatData.detail
            : JSON.stringify(chatData?.detail ?? chatData);
        throw new Error(detail || `HTTP ${chatRes.status}`);
      }
      aiResponse = (chatData.response as string) || "";
      done = Boolean(chatData.interview_done);

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: done ? `${aiResponse}\n\n(Interview complete.)` : aiResponse,
        },
      ]);
      if (done) {
        setBrainReady(false);
        interviewSessionIdRef.current = null;
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      // Re-enable typing as soon as the brain responds; avatar TTS must not block input.
      setIsChatting(false);
    }
    if (aiResponse.trim()) {
      try {
        await speakThroughAvatar(aiResponse);
      } catch (e) {
        console.error("Avatar speak failed:", e);
      }
    }
  };

  useEffect(() => {
    return () => {
      clearAvatarKeepAlive();
      const a = avatarRef.current;
      if (a && typeof a.stop === "function") {
        void a.stop();
      }
      avatarRef.current = null;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-6 text-cyan-400">Mock Live Interview</h1>

      {/* Video Player Container */}
      <div className="w-full max-w-3xl aspect-video bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6 relative flex items-center justify-center">
        
        {/* Added raw HTML ID here! */}
        <video 
          id="avatar-video"
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${sessionActive ? 'block' : 'hidden'}`}
        >
          <track kind="captions" />
        </video>

        {/* Start Button Overlay */}
        {!sessionActive && (
          <div className="absolute z-10 flex flex-col items-center gap-4 w-[min(100%,36rem)] px-4">
            <p className="text-gray-400">Video feed offline.</p>
            <label className="w-full text-left text-sm text-gray-400">
              Your background (sent to the interview engine)
              <textarea
                value={knowledge}
                onChange={(e) => setKnowledge(e.target.value)}
                rows={3}
                disabled={isAvatarStarting}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-cyan-500 resize-y"
              />
            </label>
            <button 
              onClick={startAvatarSession}
              disabled={isAvatarStarting}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              {isAvatarStarting ? "Booting up Avatar..." : "Start Interview"}
            </button>
          </div>
        )}
        {sessionActive && isStartingBrain && (
          <div className="absolute z-10 bottom-3 left-3 right-3 text-center text-sm text-cyan-200/90 bg-gray-950/80 rounded-lg py-2 px-3">
            Connecting to interview engine…
          </div>
        )}
        {sessionActive && !brainReady && !isStartingBrain && (
          <div className="absolute z-10 bottom-3 left-3 right-3 flex justify-center">
            <button
              type="button"
              onClick={() => void startInterviewBrain()}
              className="text-sm bg-amber-700/90 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg"
            >
              Retry interview engine
            </button>
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <div className="h-40 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-2">
          {messages.map((msg, idx) => (
            <div key={idx} className={`p-2 rounded max-w-[85%] ${msg.role === "user" ? "bg-cyan-900 self-end" : "bg-gray-800 self-start"}`}>
              <span className="font-bold text-xs text-gray-400 block">{msg.role === "user" ? "You" : "Interviewer"}</span>
              <span className="text-sm">{msg.text}</span>
            </div>
          ))}
          {messages.length === 0 && <p className="text-gray-600 text-sm italic text-center mt-4">Conversation history will appear here...</p>}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your answer here..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500"
            disabled={!sessionActive || !brainReady || isChatting || isStartingBrain}
          />
          <button 
            onClick={sendMessage}
            disabled={!sessionActive || !brainReady || isChatting || isStartingBrain}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-lg transition-colors disabled:opacity-50"
          >
            {isChatting ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}