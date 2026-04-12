"use client";

import { useEffect, useRef, useState } from "react";
import {
  CodeEditorPanel,
  type CodeTestResultRow,
  type KeystrokeSummary,
  type LangId,
} from "@/components/code-editor";
import { CodingProblemPanel, type CodingProblem } from "@/components/coding-problem-panel";
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

const INTEGRITY_FLAG_LABELS: Record<string, string> = {
  heavy_paste:
    "A large block of text was inserted at once — many proctored platforms flag sudden large pastes.",
  frequent_tab_away:
    "The tab was switched away from several times — real assessments often log focus changes.",
  long_idle: "There was a long stretch with no typing — timed sessions may flag extended idle periods.",
  timed_out: "The coding timer ran out before submit (your attempt was still recorded).",
};

function integrityLines(flags: string[]): string[] {
  return flags.map((f) => INTEGRITY_FLAG_LABELS[f] ?? f);
}

function interviewApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_INTERVIEW_API_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000"
  );
}

/** Server session is source of truth if /turn JSON omits nested `coding_prompt` (serialization edge cases). */
async function syncCodingStateFromServer(base: string, sid: string) {
  try {
    const res = await fetch(`${base}/session/${sid}/state`);
    if (!res.ok) return;
    const st = (await res.json()) as Record<string, unknown>;
    if ((st.input_mode as string) !== "code") return;
    const cp = st.coding_prompt;
    if (cp && typeof cp === "object") {
      return {
        codingPrompt: cp as CodingProblem & { starter_code?: Record<string, string> },
        testResults: Array.isArray(st.test_results)
          ? (st.test_results as Record<string, unknown>[]).map((row) => ({
              input: String(row.input ?? ""),
              expected: String(row.expected ?? ""),
              actual: String(row.actual ?? ""),
              passed: Boolean(row.passed),
              note: row.note != null ? String(row.note) : undefined,
            }))
          : undefined,
      };
    }
  } catch (e) {
    console.warn("syncCodingStateFromServer:", e);
  }
  return undefined;
}

/** True when submit failed grading and user must stay in the coding UI (not RAG/chat advance). */
function testsFailedWhileInEditor(chatData: Record<string, unknown>): boolean {
  if (chatData.input_mode !== "code") return false;
  const tr = chatData.test_results;
  if (!Array.isArray(tr) || tr.length === 0) return false;
  return tr.some((row) => {
    const o = row as { passed?: boolean };
    return !o.passed;
  });
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
  const [inputMode, setInputMode] = useState<"chat" | "code">("chat");
  const [codingPrompt, setCodingPrompt] = useState<CodingProblem & { starter_code?: Record<string, string> } | null>(
    null,
  );
  const [integrityFlags, setIntegrityFlags] = useState<string[]>([]);
  const [integrityDismissed, setIntegrityDismissed] = useState(false);
  const [testResults, setTestResults] = useState<CodeTestResultRow[] | null>(null);
  const [awaitingExplanation, setAwaitingExplanation] = useState(false);

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
      setInputMode((data.input_mode as "chat" | "code") || "chat");
      setCodingPrompt(
        data.coding_prompt && typeof data.coding_prompt === "object"
          ? (data.coding_prompt as CodingProblem & { starter_code?: Record<string, string> })
          : null,
      );
      setIntegrityFlags(Array.isArray(data.integrity_flags) ? data.integrity_flags : []);
      setIntegrityDismissed(false);
      setTestResults(null);
      setAwaitingExplanation(Boolean(data.awaiting_explanation));
      setMessages((prev) => [...prev, { role: "ai", text: opening }]);
      if ((data.input_mode as string) === "code" && sessionId) {
        const synced = await syncCodingStateFromServer(base, sessionId);
        if (synced?.codingPrompt) setCodingPrompt(synced.codingPrompt);
      }
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

  const applyTurnResponse = (chatData: Record<string, unknown>) => {
    const mode = (chatData.input_mode as string) || "chat";
    setInputMode(mode === "code" ? "code" : "chat");
    const cp = chatData.coding_prompt;
    setCodingPrompt(
      cp && typeof cp === "object" ? (cp as CodingProblem & { starter_code?: Record<string, string> }) : null,
    );
    const flags = chatData.integrity_flags;
    setIntegrityFlags(Array.isArray(flags) ? (flags as string[]) : []);
    setIntegrityDismissed(false);
    setAwaitingExplanation(Boolean(chatData.awaiting_explanation));
    if (mode === "code") {
      const tr = chatData.test_results;
      if (Array.isArray(tr)) {
        setTestResults(
          tr.map((row) => {
            const o = row as Record<string, unknown>;
            return {
              input: String(o.input ?? ""),
              expected: String(o.expected ?? ""),
              actual: String(o.actual ?? ""),
              passed: Boolean(o.passed),
              note: o.note != null ? String(o.note) : undefined,
            };
          }),
        );
      } else {
        setTestResults(null);
      }
    } else {
      setTestResults(null);
    }
    return {
      aiResponse: (chatData.response as string) || "",
      done: Boolean(chatData.interview_done),
    };
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
    let suppressAvatarForTestFail = false;
    try {
      const chatRes = await fetch(`${base}/session/${sid}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: userText }),
      });
      const chatData = (await chatRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!chatRes.ok) {
        const detail =
          typeof chatData?.detail === "string"
            ? chatData.detail
            : JSON.stringify(chatData?.detail ?? chatData);
        throw new Error(detail || `HTTP ${chatRes.status}`);
      }
      ({ aiResponse, done } = applyTurnResponse(chatData));

      if (chatData.input_mode === "code") {
        const synced = await syncCodingStateFromServer(base, sid);
        if (synced?.codingPrompt) setCodingPrompt(synced.codingPrompt);
      }

      const gateFailed = testsFailedWhileInEditor(chatData);
      suppressAvatarForTestFail = gateFailed;
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: done
            ? `${aiResponse}\n\n(Interview complete.)`
            : gateFailed
              ? (String(chatData.response ?? aiResponse).trim() ||
                  "Tests failed — see the panel below the editor.")
              : aiResponse,
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
      setIsChatting(false);
    }
    if (aiResponse.trim() && !suppressAvatarForTestFail) {
      try {
        await speakThroughAvatar(aiResponse);
      } catch (e) {
        console.error("Avatar speak failed:", e);
      }
    }
  };

  const sendCodeSubmission = async (code: string, language: LangId, summary: KeystrokeSummary) => {
    const sid = interviewSessionIdRef.current;
    if (!sid || isChatting || !brainReady) return;
    setIsChatting(true);
    setMessages((prev) => [...prev, { role: "user", text: `[Submitted ${language} code]` }]);
    const base = interviewApiBase();
    let aiResponse = "";
    let done = false;
    let suppressAvatarForTestFail = false;
    try {
      const chatRes = await fetch(`${base}/session/${sid}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: "Code submission (see editor).",
          code,
          language,
          keystroke_summary: { ...summary, integrity_flags: summary.integrity_flags },
        }),
      });
      const chatData = (await chatRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!chatRes.ok) {
        const detail =
          typeof chatData?.detail === "string"
            ? chatData.detail
            : JSON.stringify(chatData?.detail ?? chatData);
        throw new Error(detail || `HTTP ${chatRes.status}`);
      }
      ({ aiResponse, done } = applyTurnResponse(chatData));

      if (chatData.input_mode === "code") {
        const synced = await syncCodingStateFromServer(base, sid);
        if (synced?.codingPrompt) setCodingPrompt(synced.codingPrompt);
        if (
          synced?.testResults != null &&
          (!Array.isArray(chatData.test_results) || (chatData.test_results as unknown[]).length === 0)
        ) {
          setTestResults(synced.testResults);
        }
      }

      const gateFailed = testsFailedWhileInEditor(chatData);
      suppressAvatarForTestFail = gateFailed;

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: done
            ? `${aiResponse}\n\n(Interview complete.)`
            : gateFailed
              ? (String(chatData.response ?? aiResponse).trim() ||
                  "Tests failed — see the panel below the editor.")
              : aiResponse,
        },
      ]);
      if (done) {
        setBrainReady(false);
        interviewSessionIdRef.current = null;
      }
    } catch (error) {
      console.error("Code submit error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ]);
    } finally {
      setIsChatting(false);
    }
    if (aiResponse.trim() && !suppressAvatarForTestFail) {
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

  const codingActive = inputMode === "code" && codingPrompt != null;
  const showIntegrityBanner = integrityFlags.length > 0 && !integrityDismissed;

  const videoBlock = (
    <div
      className={`aspect-video w-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden relative flex items-center justify-center ${codingActive ? "mb-3" : "mb-6"}`}
    >
      <video
        id="avatar-video"
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${sessionActive ? "block" : "hidden"}`}
      >
        <track kind="captions" />
      </video>
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
  );

  const chatLog = (
    <div
      className={`overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-2 ${codingActive ? "h-48" : "h-40"}`}
    >
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`p-2 rounded max-w-[85%] ${msg.role === "user" ? "bg-cyan-900 self-end" : "bg-gray-800 self-start"}`}
        >
          <span className="font-bold text-xs text-gray-400 block">
            {msg.role === "user" ? "You" : "Interviewer"}
          </span>
          <span className="text-sm">{msg.text}</span>
        </div>
      ))}
      {messages.length === 0 && (
        <p className="text-gray-600 text-sm italic text-center mt-4">Conversation history will appear here...</p>
      )}
    </div>
  );

  const chatInputRow = (
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Type your answer here..."
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500"
        disabled={!sessionActive || !brainReady || isChatting || isStartingBrain || codingActive}
      />
      <button
        onClick={sendMessage}
        disabled={!sessionActive || !brainReady || isChatting || isStartingBrain || codingActive}
        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-lg transition-colors disabled:opacity-50"
      >
        {isChatting ? "Thinking..." : "Send"}
      </button>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-6 text-cyan-400">Mock Live Interview</h1>

      {showIntegrityBanner ? (
        <div className="mb-4 flex w-full max-w-6xl items-start justify-between gap-2 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          <div>
            <span className="font-semibold">Practice note: </span>
            <ul className="mt-1 list-inside list-disc space-y-1 text-amber-100/95">
              {integrityLines(integrityFlags).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="shrink-0 text-amber-300 underline"
            onClick={() => setIntegrityDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {codingActive ? (
        <div className="flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex w-full min-w-0 flex-col lg:w-[40%]">
            {videoBlock}
            {chatLog}
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-[60%] lg:pl-2">
            {codingPrompt ? <CodingProblemPanel problem={codingPrompt} /> : null}
            {codingPrompt ? (
              <CodeEditorPanel
                problem={codingPrompt}
                disabled={isChatting || !brainReady || isStartingBrain}
                onSubmit={sendCodeSubmission}
                testResults={testResults}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="w-full max-w-3xl">{videoBlock}</div>
          <div className="w-full max-w-3xl flex flex-col gap-4">
            {awaitingExplanation ? (
              <p className="rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
                Walk through your solution in your own words below — then we&apos;ll continue the interview.
              </p>
            ) : null}
            {chatLog}
            {chatInputRow}
          </div>
        </>
      )}

      {codingActive ? (
        <div className="mt-4 w-full max-w-6xl text-center text-xs text-gray-500">
          Chat input is paused during the coding exercise — use Submit code or wait for the timer.
        </div>
      ) : null}
    </main>
  );
}