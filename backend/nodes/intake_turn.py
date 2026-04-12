"""Handle user turns while phase is intake: more questions or transition to technical + roadmap."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm_factory import get_chat, text_from_llm_response
from ..state import InterviewState
from .generator import open_coding_session, roadmap_and_open_behavioral, roadmap_and_open_technical
from .intake import combined_knowledge_from_state, intake_has_enough_for_plan, parse_intake
from .planner import (
    build_agenda,
    build_agenda_behavioral_only,
    build_agenda_coding_only,
    build_roadmap_blob,
    build_roadmap_blob_behavioral,
    build_roadmap_blob_coding,
)
from .retriever import retrieve_context

_MIN_USER_TURNS = 3
_MAX_USER_TURNS = 8

_INTAKE_FOLLOWUP_SYSTEM = """You are collecting intake for a mock SWE interview (not interviewing technically yet).
Rules:
- Use the signup profile (job title, company, job description, resume) when provided: ask follow-ups that fill gaps relative to that role—do not re-read the JD aloud.
- Stay in intake only: do NOT ask coding, algorithms, data-structure, or system-design questions.
- If they ask what else you need, whether that's enough, or similar: answer clearly in one short sentence
  (e.g. "I'd like your target role and one concrete thing you've built or shipped"), then you may add
  ONE optional short question — or only the clarifying sentence if that fully answers them.
- If they ask you to repeat or say they didn’t hear you: restate your last intake question briefly—no thank-you, no fake gratitude.
- If they say something odd or off-topic: one short natural response, then steer back to intake—do not thank them as if they answered.
- Do not call their background "strong" or similar unless they gave specific evidence in the transcript.
- Do not pivot to the structured interview roadmap or "Part 1" in intake; that comes after intake ends.
- Keep total reply under 90 words, no bullet lists."""

_INTAKE_FOLLOWUP_SYSTEM_BEHAVIORAL = """You are collecting intake for a behavioral mock interview only.
Rules:
- Use the signup profile (job title, company, job description, resume) when provided: tailor intake to that role and what the JD emphasizes—do not quote the JD verbatim.
- Stay in intake: do NOT ask coding, algorithms, data-structure, or system-design questions.
- Do NOT ask technical troubleshooting or architecture questions.
- If they ask what else you need: answer in one short sentence, then at most ONE clarifying question.
- If they ask you to repeat or didn’t catch that: restate your last question briefly—no thank-you.
- If they say something odd or off-topic: respond briefly and redirect to intake—no empty thanks.
- Do not praise their background without specific evidence in the transcript.
- Do not say you are starting "Part 1 technical" or similar.
- Keep under 90 words, no bullet lists."""

_INTAKE_FOLLOWUP_SYSTEM_CODING = """You are collecting quick context before a timed coding exercise in an editor.
Rules:
- Use the signup profile when provided; do not read the JD verbatim.
- Stay in intake: do NOT ask them to solve problems, write code, pseudocode, or big-O. No system design.
- If they ask what happens next: say they'll get one coding problem in the editor after this.
- Keep under 90 words, no bullet lists."""


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
    mode = (state.get("interview_mode") or "full").lower()
    if mode == "behavioral":
        system = _INTAKE_FOLLOWUP_SYSTEM_BEHAVIORAL
    elif mode == "coding":
        system = _INTAKE_FOLLOWUP_SYSTEM_CODING
    else:
        system = _INTAKE_FOLLOWUP_SYSTEM
    lines: list[str] = []
    for m in (state.get("conversation_history") or [])[-14:]:
        r, c = m.get("role", ""), (m.get("content") or "").strip()
        if c:
            lines.append(f"{r}: {c}")
    transcript = "\n".join(lines)
    signup = (state.get("knowledge") or "").strip()
    profile_note = (
        f"Signup profile (for tailoring only; do not recite):\n{signup[:4000]}\n\n"
        if signup
        else ""
    )
    raw = llm.invoke(
        [
            SystemMessage(content=system),
            HumanMessage(content=f"{profile_note}Transcript so far:\n{transcript}"),
        ]
    )
    text = text_from_llm_response(raw)
    return _append_assistant(state, text)


def _should_close_intake(state: InterviewState, n_user: int) -> bool:
    mode = (state.get("interview_mode") or "full").lower()
    if mode == "coding":
        if n_user >= _MAX_USER_TURNS:
            return True
        if n_user < 1:
            return False
        return True
    if n_user >= _MAX_USER_TURNS:
        return True
    if n_user < _MIN_USER_TURNS:
        return False
    return intake_has_enough_for_plan(state)


def _finalize_intake(state: InterviewState) -> dict:
    combined = combined_knowledge_from_state(state)
    parsed = parse_intake({**dict(state), "knowledge": combined})
    mode = (state.get("interview_mode") or "full").lower()
    if mode == "behavioral":
        agenda_updates = build_agenda_behavioral_only({**dict(state), **parsed})
        roadmap_updates = build_roadmap_blob_behavioral({**dict(state), **parsed, **agenda_updates})
        merged: InterviewState = {
            **dict(state),
            **parsed,
            **agenda_updates,
            **roadmap_updates,
        }
        merged = {**merged, **retrieve_context(merged)}
        return {**merged, **roadmap_and_open_behavioral(merged)}
    if mode == "coding":
        agenda_updates = build_agenda_coding_only({**dict(state), **parsed})
        roadmap_updates = build_roadmap_blob_coding({**dict(state), **parsed, **agenda_updates})
        merged_c: InterviewState = {
            **dict(state),
            **parsed,
            **agenda_updates,
            **roadmap_updates,
        }
        merged_c = {**merged_c, **retrieve_context(merged_c)}
        return {**merged_c, **open_coding_session(merged_c)}
    agenda_updates = build_agenda({**dict(state), **parsed})
    roadmap_updates = build_roadmap_blob({**dict(state), **parsed, **agenda_updates})
    merged = {
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
