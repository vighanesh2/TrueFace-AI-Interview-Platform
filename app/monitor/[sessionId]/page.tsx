"use client";

import { useEffect, useState } from "react";
import { use } from "react";

const ML_ENGINE_URL = "http://localhost:8001";

interface SignalData {
  score: number;
  label: string;
  weight?: number;
}

interface MLReport {
  final_score: number;
  risk_level: string;
  recommendation: string;
  candidate_name: string;
  signal_breakdown: {
    deepfake_detection: SignalData;
    voice_authenticity: SignalData;
    reasoning_continuity: SignalData;
    response_latency: SignalData;
    speech_patterns: SignalData;
    proctoring?: SignalData;
  };
  session_stats?: {
    frames_analyzed: number;
    voice_chunks_analyzed: number;
    conversation_turns: number;
  };
}

interface ProctoringEvent {
  type: string;
  timestamp: number;
  details: string;
  severity: string;
}

export default function MonitorPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [report, setReport] = useState<MLReport | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([]);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(
          `${ML_ENGINE_URL}/session/report?candidate_id=${sessionId}&candidate_name=Candidate`,
          { method: "POST" }
        );
        if (res.ok) {
          const data = await res.json();
          setReport(data);
          setConnected(true);
          setLastUpdate(new Date());
          setPollCount(prev => prev + 1);
        }

        // Fetch proctoring events
        const procRes = await fetch(
          `${ML_ENGINE_URL}/session/proctoring/${sessionId}`
        );
        if (procRes.ok) {
          const procData = await procRes.json();
          if (procData.proctoring_events) {
            setProctoringEvents(procData.proctoring_events);
          }
        }
      } catch {
        setConnected(false);
      }
    };

    fetchReport();
    const interval = setInterval(fetchReport, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const getRiskColor = (risk: string) => {
    if (risk === "AUTHENTIC") return "text-green-400";
    if (risk === "LOW RISK") return "text-green-300";
    if (risk === "MEDIUM RISK") return "text-yellow-400";
    if (risk === "HIGH RISK") return "text-red-500";
    return "text-gray-400";
  };

  const getRiskBg = (risk: string) => {
    if (risk === "AUTHENTIC") return "bg-green-900/30 border-green-700";
    if (risk === "LOW RISK") return "bg-green-900/20 border-green-800";
    if (risk === "MEDIUM RISK") return "bg-yellow-900/30 border-yellow-700";
    if (risk === "HIGH RISK") return "bg-red-900/30 border-red-700";
    return "bg-gray-900 border-gray-700";
  };

  const getBarColor = (score: number) => {
    if (score < 0.35) return "bg-green-500";
    if (score < 0.55) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLabelColor = (label: string) => {
    if (label === "real" || label === "authentic" || label === "clean") return "text-green-400";
    if (label === "fake" || label === "suspicious" || label === "LIKELY_CHEATING") return "text-red-400";
    return "text-yellow-400";
  };

  const authenticityPct = report ? Math.round((1 - report.final_score) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">TrueFace</h1>
            <p className="text-gray-400 text-sm mt-1">Company Monitor — Live Session</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${connected ? "bg-green-900 text-green-400" : "bg-gray-800 text-gray-500"}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
              {connected ? "LIVE" : "CONNECTING..."}
            </div>
            <div className="text-xs text-gray-500">
              Session: {sessionId.slice(-8)}
            </div>
          </div>
        </div>

        {/* Main Score */}
        {report ? (
          <>
            <div className={`rounded-2xl border p-8 mb-6 ${getRiskBg(report.risk_level)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-7xl font-bold text-white mb-2">
                    {authenticityPct}%
                  </div>
                  <div className="text-gray-400 text-sm mb-3">Authenticity Score</div>
                  <div className={`text-2xl font-bold ${getRiskColor(report.risk_level)}`}>
                    {report.risk_level}
                  </div>
                  <div className="text-gray-400 text-sm mt-2 max-w-md">
                    {report.recommendation}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-6xl mb-2">
                    {report.risk_level === "HIGH RISK" ? "🚨" :
                     report.risk_level === "MEDIUM RISK" ? "⚠️" :
                     report.risk_level === "LOW RISK" ? "✅" : "✅"}
                  </div>
                  {lastUpdate && (
                    <div className="text-xs text-gray-500">
                      Updated {lastUpdate.toLocaleTimeString()}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Poll #{pollCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Signal Breakdown */}
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Signal Breakdown
                </h2>
                <div className="flex flex-col gap-4">
                  {Object.entries(report.signal_breakdown).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm text-gray-300 capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${getLabelColor(val.label)}`}>
                            {val.label.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {(val.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-700 ${getBarColor(val.score)}`}
                          style={{ width: `${val.score * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Session Stats */}
            {report.session_stats && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Session Activity
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {report.session_stats.frames_analyzed}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Frames Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {report.session_stats.conversation_turns}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Q&A Exchanges</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {report.session_stats.voice_chunks_analyzed}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Audio Chunks</div>
                  </div>
                </div>
              </div>
            )}

            {/* Proctoring Events */}
            {proctoringEvents.filter(e => e.severity !== 'low').length > 0 && (
              <div className="bg-red-950 border border-red-800 rounded-xl p-6">
                <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4">
                  🚨 Integrity Flags ({proctoringEvents.filter(e => e.severity !== 'low').length})
                </h2>
                <div className="flex flex-col gap-2">
                  {proctoringEvents
                    .filter(e => e.severity !== 'low')
                    .map((event, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <span className={`font-bold shrink-0 ${event.severity === 'high' ? 'text-red-400' : 'text-yellow-400'}`}>
                          [{event.severity.toUpperCase()}]
                        </span>
                        <span className="text-red-300">
                          {event.type.replace(/_/g, ' ')} — {event.details}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <div className="text-6xl mb-4">🛡️</div>
            <div className="text-xl font-bold text-white mb-2">Waiting for session</div>
            <div className="text-gray-400 text-sm">
              Share session ID <span className="text-cyan-400 font-mono">{sessionId}</span> with the candidate
            </div>
            <div className="text-gray-500 text-xs mt-4">
              Scores will appear automatically once the interview starts
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 text-center">
            Share this URL with your team to monitor live •{" "}
            <span className="text-cyan-400">
              Candidate session: {sessionId}
            </span>{" "}
            • Scores update every 3 seconds
          </p>
        </div>
      </div>
    </div>
  );
}