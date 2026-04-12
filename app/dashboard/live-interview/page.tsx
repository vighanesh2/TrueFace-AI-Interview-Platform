"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateLiveInterviewPage() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState<"behavioral" | "technical">("behavioral");
  const [created, setCreated] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const createSession = () => {
    const id = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSessionId(id);
    setCreated(true);
  };

  const candidateUrl = `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/live-interview/${sessionId}`;
  const monitorUrl = `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/monitor/candidate_${sessionId}`;

  if (created) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">Session Created</h1>
          <p className="text-gray-400 mb-8">Share the links below with the candidate and your team.</p>

          <div className="bg-gray-900 border border-green-800 rounded-xl p-6 mb-4">
            <h2 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-2">
              📨 Candidate Link — Send this to {candidateName || "the candidate"}
            </h2>
            <div className="text-sm text-green-300 font-mono break-all mb-3">{candidateUrl}</div>
            <button
              onClick={() => navigator.clipboard.writeText(candidateUrl)}
              className="text-xs bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Copy Candidate Link
            </button>
          </div>

          <div className="bg-gray-900 border border-cyan-800 rounded-xl p-6 mb-4">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">
              🛡️ Company Monitor — Open this to watch live
            </h2>
            <div className="text-sm text-cyan-300 font-mono break-all mb-3">{monitorUrl}</div>
            <button
              onClick={() => navigator.clipboard.writeText(monitorUrl)}
              className="text-xs bg-cyan-800 hover:bg-cyan-700 text-white px-4 py-2 rounded mr-2"
            >
              Copy Monitor Link
            </button>
            <button
              onClick={() => window.open(monitorUrl, "_blank")}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Open Monitor →
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Session Details</h2>
            <div className="text-sm text-gray-300 space-y-1">
              <div><span className="text-gray-500">Candidate:</span> {candidateName || "Not specified"}</div>
              <div><span className="text-gray-500">Role:</span> {role || "Not specified"}</div>
              <div><span className="text-gray-500">Type:</span> {interviewType}</div>
              <div><span className="text-gray-500">Session ID:</span> <span className="font-mono text-xs">{sessionId}</span></div>
            </div>
          </div>

          <button
            onClick={() => { setCreated(false); setSessionId(""); }}
            className="text-sm text-gray-400 hover:text-white underline"
          >
            ← Create another session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-cyan-400 mb-2">Create Live Interview</h1>
        <p className="text-gray-400 mb-8">Set up a verified interview session. You'll get a candidate link and a live monitor link.</p>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Candidate Name</label>
            <input
              type="text"
              value={candidateName}
              onChange={e => setCandidateName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Role</label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Software Engineering Intern"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Interview Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setInterviewType("behavioral")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${interviewType === "behavioral" ? "bg-cyan-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              >
                Behavioral
              </button>
              <button
                onClick={() => setInterviewType("technical")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${interviewType === "technical" ? "bg-cyan-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              >
                Technical
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Job Description (optional)</label>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste job description here..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-600"
            />
          </div>

          <button
            onClick={createSession}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Create Interview Session →
          </button>
        </div>
      </div>
    </div>
  );
}
