"""FastAPI interview orchestration API."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .graph import run_session_start, run_session_turn
from .llm_code_tests import ensure_problem_has_test_cases, evaluate_code_with_gemini
from .state import InterviewState

_PHASE_LABELS: dict[str, str] = {
    "intake": "Intake",
    "technical": "Part 1 — Technical",
    "system_design": "Part 2 — System design",
    "behavioral": "Part 3 — Behavioral",
    "wrap_up": "Closing",
}


def _phase_label(phase: str | None) -> str:
    if not phase:
        return "Unknown"
    return _PHASE_LABELS.get(phase, phase.replace("_", " ").title())


app = FastAPI(title="TRUEFACE Interview Brain", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_sessions: dict[str, InterviewState] = {}


class StartBody(BaseModel):
    knowledge: str = Field(..., min_length=1)
    mode: Literal["full", "behavioral"] = "full"


class TurnBody(BaseModel):
    answer: str = Field(..., min_length=1)
    code: str | None = None
    language: str | None = None
    keystroke_summary: dict[str, Any] | None = None


class StartResponse(BaseModel):
    session_id: str
    response: str
    phase: str
    phase_label: str
    turn: int
    topic: str
    current_part_index: int = 0
    roadmap: dict[str, Any] | None = None
    input_mode: str = "chat"
    coding_prompt: dict[str, Any] | None = None
    integrity_flags: list[str] = Field(default_factory=list)
    test_results: list[dict[str, Any]] | None = None
    awaiting_explanation: bool = False
    test_runner: str | None = None


class TurnResponse(BaseModel):
    response: str
    phase: str
    phase_label: str
    turn: int
    topic: str
    interview_done: bool
    current_part_index: int = 0
    roadmap: dict[str, Any] | None = None
    input_mode: str = "chat"
    coding_prompt: dict[str, Any] | None = None
    integrity_flags: list[str] = Field(default_factory=list)
    test_results: list[dict[str, Any]] | None = None
    awaiting_explanation: bool = False
    test_runner: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/session/start", response_model=StartResponse)
def session_start(body: StartBody) -> StartResponse:
    sid = str(uuid.uuid4())
    state: InterviewState = {
        "session_id": sid,
        "interview_mode": body.mode,
        "knowledge": body.knowledge.strip(),
        "conversation_history": [],
        "turn_count": 0,
        "interview_done": False,
    }
    try:
        out = run_session_start(state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    _sessions[sid] = out
    ph = out.get("phase") or "intake"
    return StartResponse(
        session_id=sid,
        response=out.get("next_response") or "",
        phase=ph,
        phase_label=_phase_label(ph),
        turn=int(out.get("turn_count") or 0),
        topic=out.get("current_topic") or "",
        current_part_index=int(out.get("current_part_index") or 0),
        roadmap=out.get("roadmap"),
        input_mode=str(out.get("input_mode") or "chat"),
        coding_prompt=out.get("coding_prompt") if isinstance(out.get("coding_prompt"), dict) else None,
        integrity_flags=list(out.get("integrity_flags") or []),
        test_results=out.get("test_results") if isinstance(out.get("test_results"), list) else None,
        awaiting_explanation=bool(out.get("awaiting_explanation")),
        test_runner=out.get("last_test_runner") if isinstance(out.get("last_test_runner"), str) else None,
    )


def _format_user_turn_content(body: TurnBody) -> str:
    ans = body.answer.strip()
    if body.code and body.code.strip():
        lang = (body.language or "text").strip()
        code = body.code.strip()
        return (
            f"[Code submission]\nlanguage: {lang}\n\n```{lang}\n{code}\n```\n\n"
            f"(Verbal note: {ans})"
        )
    return ans


@app.post("/session/{session_id}/turn", response_model=TurnResponse)
def session_turn(session_id: str, body: TurnBody) -> TurnResponse:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    st = dict(_sessions[session_id])
    if not (body.code and body.code.strip()):
        st["integrity_flags"] = []
    hist = list(st.get("conversation_history") or [])
    user_content = _format_user_turn_content(body)
    hist.append({"role": "user", "content": user_content})
    st["conversation_history"] = hist

    if body.code and body.code.strip():
        subs = list(st.get("code_submissions") or [])
        ks = dict(body.keystroke_summary or {})
        integrity = list(ks.get("integrity_flags") or [])
        subs.append(
            {
                "code": body.code.strip(),
                "language": (body.language or "").strip(),
                "keystroke_summary": ks,
                "submitted_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        st["code_submissions"] = subs
        st["integrity_flags"] = integrity

        cp_raw = st.get("coding_prompt")
        if isinstance(cp_raw, dict) and (st.get("input_mode") or "") == "code":
            cp = ensure_problem_has_test_cases(cp_raw)
            st["coding_prompt"] = cp
            try:
                lang = (body.language or "python").strip().lower()
                tc = cp.get("test_cases") or []
                eval_out = evaluate_code_with_gemini(cp, body.code.strip(), lang, tc)
            except Exception:
                eval_out = {
                    "all_passed": False,
                    "test_results": [
                        {
                            "input": "—",
                            "expected": "—",
                            "actual": "",
                            "passed": False,
                            "note": "Automated check failed to run (temporary error).",
                        }
                    ],
                    "summary_message": "Could not run practice tests right now — stay in the editor and try again.",
                    "runner_used": "gemini",
                }
            st["test_results"] = list(eval_out.get("test_results") or [])
            st["last_test_runner"] = str(eval_out.get("runner_used") or "gemini")
            if not eval_out.get("all_passed"):
                _sessions[session_id] = st
                ph = st.get("phase") or ""
                return TurnResponse(
                    response=str(eval_out.get("summary_message") or "Some tests failed."),
                    phase=str(ph),
                    phase_label=_phase_label(ph),
                    turn=int(st.get("turn_count") or 0),
                    topic=st.get("current_topic") or "",
                    interview_done=bool(st.get("interview_done")),
                    current_part_index=int(st.get("current_part_index") or 0),
                    roadmap=st.get("roadmap"),
                    input_mode="code",
                    coding_prompt=cp,
                    integrity_flags=list(st.get("integrity_flags") or []),
                    test_results=st["test_results"],
                    awaiting_explanation=False,
                    test_runner=st.get("last_test_runner"),
                )

    try:
        out = run_session_turn(st)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    out = dict(out)
    if str(out.get("input_mode") or "") == "code":
        cp_out = out.get("coding_prompt")
        if not isinstance(cp_out, dict):
            cp_prev = st.get("coding_prompt")
            if isinstance(cp_prev, dict):
                out["coding_prompt"] = cp_prev
    _sessions[session_id] = out
    ph = out.get("phase") or ""
    return TurnResponse(
        response=out.get("next_response") or "",
        phase=ph,
        phase_label=_phase_label(ph),
        turn=int(out.get("turn_count") or 0),
        topic=out.get("current_topic") or "",
        interview_done=bool(out.get("interview_done")),
        current_part_index=int(out.get("current_part_index") or 0),
        roadmap=out.get("roadmap"),
        input_mode=str(out.get("input_mode") or "chat"),
        coding_prompt=out.get("coding_prompt") if isinstance(out.get("coding_prompt"), dict) else None,
        integrity_flags=list(out.get("integrity_flags") or []),
        test_results=out.get("test_results") if isinstance(out.get("test_results"), list) else None,
        awaiting_explanation=bool(out.get("awaiting_explanation")),
        test_runner=out.get("last_test_runner") if isinstance(out.get("last_test_runner"), str) else None,
    )


@app.get("/session/{session_id}/state")
def session_state(session_id: str) -> dict[str, Any]:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    return dict(_sessions[session_id])
