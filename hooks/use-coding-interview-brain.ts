"use client";

import { useCallback, useRef, useState } from "react";
import type { CodeTestResultRow, KeystrokeSummary, LangId } from "@/components/code-editor";
import {
  interviewApiBase,
  mapTestResultsFromTurn,
  syncCodingStateFromServer,
  testsFailedWhileInEditor,
  type CodingPromptState,
} from "@/lib/coding-interview-api";

export type CodingTurnResult =
  | {
      ok: true;
      aiResponse: string;
      done: boolean;
      suppressAvatar: boolean;
    }
  | { ok: false; error: string };

export function useCodingInterviewBrain() {
  const sessionIdRef = useRef<string | null>(null);
  const [brainReady, setBrainReady] = useState(false);
  const [isStartingBrain, setIsStartingBrain] = useState(false);
  const [inputMode, setInputMode] = useState<"chat" | "code">("chat");
  const [codingPrompt, setCodingPrompt] = useState<CodingPromptState | null>(null);
  const [testResults, setTestResults] = useState<CodeTestResultRow[] | null>(null);
  const [integrityFlags, setIntegrityFlags] = useState<string[]>([]);
  const [integrityDismissed, setIntegrityDismissed] = useState(false);
  const [awaitingExplanation, setAwaitingExplanation] = useState(false);

  const reset = useCallback(() => {
    sessionIdRef.current = null;
    setBrainReady(false);
    setIsStartingBrain(false);
    setInputMode("chat");
    setCodingPrompt(null);
    setTestResults(null);
    setIntegrityFlags([]);
    setIntegrityDismissed(false);
    setAwaitingExplanation(false);
  }, []);

  const applyTurnResponse = useCallback((chatData: Record<string, unknown>) => {
    const mode = (chatData.input_mode as string) || "chat";
    setInputMode(mode === "code" ? "code" : "chat");
    const cp = chatData.coding_prompt;
    setCodingPrompt(
      cp && typeof cp === "object" ? (cp as CodingPromptState) : null
    );
    const flags = chatData.integrity_flags;
    setIntegrityFlags(Array.isArray(flags) ? (flags as string[]) : []);
    setIntegrityDismissed(false);
    setAwaitingExplanation(Boolean(chatData.awaiting_explanation));
    if (mode === "code") {
      const mapped = mapTestResultsFromTurn(chatData);
      setTestResults(mapped);
    } else {
      setTestResults(null);
    }
    const aiResponse = (chatData.response as string) || "";
    const done = Boolean(chatData.interview_done);
    const suppressAvatar = testsFailedWhileInEditor(chatData);
    return { aiResponse, done, suppressAvatar };
  }, []);

  const startBrain = useCallback(
    async (knowledge: string): Promise<{ ok: true; opening: string } | { ok: false; error: string }> => {
      const base = interviewApiBase();
      const k = knowledge.trim() || "Software engineering interview practice.";
      setIsStartingBrain(true);
      setBrainReady(false);
      sessionIdRef.current = null;
      let opening = "";
      try {
        const res = await fetch(`${base}/session/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knowledge: k, mode: "coding" }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          const detail =
            typeof data?.detail === "string"
              ? data.detail
              : JSON.stringify(data?.detail ?? data);
          return { ok: false, error: detail || `HTTP ${res.status}` };
        }
        const sessionId = data.session_id as string;
        opening = (data.response as string) || "";
        sessionIdRef.current = sessionId;
        setBrainReady(true);
        setInputMode((data.input_mode as "chat" | "code") || "chat");
        setCodingPrompt(
          data.coding_prompt && typeof data.coding_prompt === "object"
            ? (data.coding_prompt as CodingPromptState)
            : null
        );
        setIntegrityFlags(Array.isArray(data.integrity_flags) ? (data.integrity_flags as string[]) : []);
        setIntegrityDismissed(false);
        setTestResults(null);
        setAwaitingExplanation(Boolean(data.awaiting_explanation));
        if ((data.input_mode as string) === "code" && sessionId) {
          const synced = await syncCodingStateFromServer(base, sessionId);
          if (synced?.codingPrompt) setCodingPrompt(synced.codingPrompt);
        }
        return { ok: true, opening };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      } finally {
        setIsStartingBrain(false);
      }
    },
    []
  );

  const sendChatTurn = useCallback(
    async (userText: string): Promise<CodingTurnResult> => {
      const sid = sessionIdRef.current;
      if (!sid || !brainReady) {
        return { ok: false, error: "Interview engine not ready." };
      }
      const base = interviewApiBase();
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
          return { ok: false, error: detail || `HTTP ${chatRes.status}` };
        }
        const { aiResponse, done, suppressAvatar } = applyTurnResponse(chatData);
        if (chatData.input_mode === "code") {
          const synced = await syncCodingStateFromServer(base, sid);
          if (synced?.codingPrompt) setCodingPrompt(synced.codingPrompt);
        }
        if (done) {
          setBrainReady(false);
          sessionIdRef.current = null;
        }
        return { ok: true, aiResponse, done, suppressAvatar };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    [brainReady, applyTurnResponse]
  );

  const sendCodeTurn = useCallback(
    async (code: string, language: LangId, summary: KeystrokeSummary): Promise<CodingTurnResult> => {
      const sid = sessionIdRef.current;
      if (!sid || !brainReady) {
        return { ok: false, error: "Interview engine not ready." };
      }
      const base = interviewApiBase();
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
          return { ok: false, error: detail || `HTTP ${chatRes.status}` };
        }
        const { aiResponse, done, suppressAvatar } = applyTurnResponse(chatData);
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
        if (done) {
          setBrainReady(false);
          sessionIdRef.current = null;
        }
        return { ok: true, aiResponse, done, suppressAvatar };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    [brainReady, applyTurnResponse]
  );

  const giveUpCoding = useCallback(async (): Promise<CodingTurnResult> => {
    const sid = sessionIdRef.current;
    if (!sid || !brainReady) {
      return { ok: false, error: "Interview engine not ready." };
    }
    const base = interviewApiBase();
    try {
      const chatRes = await fetch(`${base}/session/${sid}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ give_up_coding: true, answer: "" }),
      });
      const chatData = (await chatRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!chatRes.ok) {
        const detail =
          typeof chatData?.detail === "string"
            ? chatData.detail
            : JSON.stringify(chatData?.detail ?? chatData);
        return { ok: false, error: detail || `HTTP ${chatRes.status}` };
      }
      const { aiResponse, done, suppressAvatar } = applyTurnResponse(chatData);
      if (chatData.input_mode === "code") {
        const synced = await syncCodingStateFromServer(base, sid);
        if (synced?.codingPrompt) setCodingPrompt(synced.codingPrompt);
      }
      if (done) {
        setBrainReady(false);
        sessionIdRef.current = null;
      }
      return { ok: true, aiResponse, done, suppressAvatar };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, [brainReady, applyTurnResponse]);

  return {
    sessionIdRef,
    brainReady,
    isStartingBrain,
    inputMode,
    codingPrompt,
    testResults,
    integrityFlags,
    integrityDismissed,
    setIntegrityDismissed,
    awaitingExplanation,
    reset,
    startBrain,
    sendChatTurn,
    sendCodeTurn,
    giveUpCoding,
  };
}
