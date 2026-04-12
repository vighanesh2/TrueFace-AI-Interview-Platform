"""FastAPI interview orchestration API."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .graph import run_session_start, run_session_turn
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


class StartResponse(BaseModel):
    session_id: str
    response: str
    phase: str
    phase_label: str
    turn: int
    topic: str
    current_part_index: int = 0
    roadmap: dict[str, Any] | None = None


class TurnResponse(BaseModel):
    response: str
    phase: str
    phase_label: str
    turn: int
    topic: str
    interview_done: bool
    current_part_index: int = 0
    roadmap: dict[str, Any] | None = None


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
    )


@app.post("/session/{session_id}/turn", response_model=TurnResponse)
def session_turn(session_id: str, body: TurnBody) -> TurnResponse:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    st = dict(_sessions[session_id])
    hist = list(st.get("conversation_history") or [])
    hist.append({"role": "user", "content": body.answer.strip()})
    st["conversation_history"] = hist
    try:
        out = run_session_turn(st)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
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
    )


@app.get("/session/{session_id}/state")
def session_state(session_id: str) -> dict[str, Any]:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    return dict(_sessions[session_id])
