"""Handle user turns while phase is intake: more questions or transition to technical + roadmap."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm_factory import get_chat, text_from_llm_response
from ..state import InterviewState
from .generator import roadmap_and_open_technical
from .intake import combined_knowledge_from_state, intake_has_enough_for_plan, parse_intake
from .planner import build_agenda, build_roadmap_blob
from .retriever import retrieve_context

_MIN_USER_TURNS = 3
_MAX_USER_TURNS = 8

_INTAKE_FOLLOWUP_SYSTEM = """You are collecting intake for a mock SWE interview (not interviewing technically yet).
Rules:
- Stay in intake only: do NOT ask coding, algorithms, data-structure, or system-design questions.
- If they ask what else you need, whether that's enough, or similar: answer clearly in one short sentence
  (e.g. "I'd like your target role and one concrete thing you've built or shipped"), then you may add
  ONE optional short question — or only the clarifying sentence if that fully answers them.
- Do not call their background "strong" or similar unless they gave specific evidence in the transcript.
- Do not pivot to the structured interview roadmap or "Part 1" in intake; that comes after intake ends.
- Keep total reply under 90 words, no bullet lists."""


def _user_turn_count(state: InterviewState) -> int:
    return sum(
        1
        for m in (state.get("conversation_history") or [])
        if m.get("role") == "user" and (m.get("content") or "").strip()
    )


def _append_assistant(state: InterviewState, text: str) -> dict:
    hist = list(state.get("conversation_history") or [])
    hist.append({"role": "assistant", "content": text.strip()})
    return {
        "next_response": text.strip(),
        "conversation_history": hist,
        "turn_count": int(state.get("turn_count") or 0) + 1,
    }


def _ask_intake_followup(state: InterviewState) -> dict:
    llm = get_chat()
    lines: list[str] = []
    for m in (state.get("conversation_history") or [])[-14:]:
        r, c = m.get("role", ""), (m.get("content") or "").strip()
        if c:
            lines.append(f"{r}: {c}")
    transcript = "\n".join(lines)
    raw = llm.invoke(
        [
            SystemMessage(content=_INTAKE_FOLLOWUP_SYSTEM),
            HumanMessage(content=f"Transcript so far:\n{transcript}"),
        ]
    )
    text = text_from_llm_response(raw)
    return _append_assistant(state, text)


def _should_close_intake(state: InterviewState, n_user: int) -> bool:
    if n_user >= _MAX_USER_TURNS:
        return True
    if n_user < _MIN_USER_TURNS:
        return False
    return intake_has_enough_for_plan(state)


def _finalize_intake(state: InterviewState) -> dict:
    combined = combined_knowledge_from_state(state)
    parsed = parse_intake({**dict(state), "knowledge": combined})
    agenda_updates = build_agenda({**dict(state), **parsed})
    roadmap_updates = build_roadmap_blob({**dict(state), **parsed, **agenda_updates})
    merged: InterviewState = {
        **dict(state),
        **parsed,
        **agenda_updates,
        **roadmap_updates,
    }
    merged = {**merged, **retrieve_context(merged)}
    return {**merged, **roadmap_and_open_technical(merged)}


def intake_turn(state: InterviewState) -> dict:
    if state.get("interview_done"):
        return {}
    n_user = _user_turn_count(state)
    if _should_close_intake(state, n_user):
        return _finalize_intake(state)
    return _ask_intake_followup(state)
