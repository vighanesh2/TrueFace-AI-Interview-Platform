"""Parse free-text knowledge into topics and level."""

from __future__ import annotations

import json
import re

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm_factory import get_chat, text_from_llm_response
from ..state import InterviewState

_INTAKE_OPENING_SYSTEM_BEHAVIORAL = """You open a behavioral-only mock interview for software engineering roles.
Rules:
- 3–4 short sentences total, no bullet lists.
- Welcome the candidate warmly.
- Say this session is focused on behavioral questions (experience, collaboration, judgment) — you will ask a few intake questions first to tailor STAR-style prompts.
- Do NOT mention coding exercises, algorithms, data structures, or system design as part of this session.
- End with exactly ONE concrete intake question (target role, team context, or what they want to practice).
- Do NOT flatter or assume skill level without evidence in this chat.
- Treat any pre-form note as internal context only: do not quote it verbatim.
- Under 130 words."""

_INTAKE_OPENING_SYSTEM = """You open a mock software-engineering interview session.
Rules:
- 3–4 short sentences total, no bullet lists.
- Welcome the candidate warmly.
- Say you will ask a few questions first to tailor the interview (intake) — do NOT ask any technical or coding question yet.
- At a high level only, mention the flow after intake: one short technical conversation, a coding exercise in an editor, then system design — not a detailed schedule.
- End with exactly ONE concrete intake question (background, target role, timeline, or focus areas).
- Do NOT flatter or assume skill level. Do NOT say they have a "strong" or "solid" background unless they stated concrete evidence in this chat (not in any pre-form text).
- Treat any pre-form note as internal context only: do not quote it or imply they already proved those things in conversation.
- Under 130 words."""

_INTAKE_OPENING_SYSTEM_CODING = """You open a timed coding practice session for software engineering roles.
Rules:
- 3–4 short sentences, no bullet lists.
- Welcome them warmly. Say that after a very brief intake they will go straight to a coding exercise in an on-screen editor — there is no separate verbal technical Q&A round first.
- Do NOT ask any coding, algorithm, or data-structure question during intake.
- End with exactly ONE concrete intake question (target role, languages they use, or what they want to practice).
- Under 120 words."""


def combined_knowledge_from_state(state: InterviewState) -> str:
    """Merge initial form text and all user replies for planning."""
    chunks: list[str] = []
    k = (state.get("knowledge") or "").strip()
    if k:
        chunks.append(f"[From signup form]\n{k}")
    for m in state.get("conversation_history") or []:
        if m.get("role") == "user" and (m.get("content") or "").strip():
            chunks.append(m["content"].strip())
    return "\n\n".join(chunks) if chunks else "No details provided; assume CS student."


def opening_intake(state: InterviewState) -> dict:
    """Session start: welcome + explain flow + first intake question only."""
    llm = get_chat()
    knowledge = (state.get("knowledge") or "").strip() or "No details yet."
    mode = (state.get("interview_mode") or "full").lower()
    if mode == "behavioral":
        system = _INTAKE_OPENING_SYSTEM_BEHAVIORAL
    elif mode == "coding":
        system = _INTAKE_OPENING_SYSTEM_CODING
    else:
        system = _INTAKE_OPENING_SYSTEM
    raw = llm.invoke(
        [
            SystemMessage(content=system),
            HumanMessage(
                content=(
                    "Optional pre-session note (for your planning only — do not praise or summarize it as fact):\n"
                    f"{knowledge}\n\n"
                    "Open the conversation naturally and ask your one intake question. "
                    "Do not imply they have already described their experience in depth."
                )
            ),
        ]
    )
    text = text_from_llm_response(raw)
    hist = [{"role": "assistant", "content": text}]
    return {
        "phase": "intake",
        "next_response": text,
        "conversation_history": hist,
        "turn_count": int(state.get("turn_count") or 0) + 1,
        "follow_up_depth": 0,
        "current_part_index": 0,
    }


def parse_intake(state: InterviewState) -> dict:
    knowledge = (state.get("knowledge") or "").strip() or "No details provided; assume CS student."
    llm = get_chat()
    raw = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You extract structured data for an interview planner. "
                    "Reply with ONLY valid JSON, no markdown: "
                    '{"topics": string[], "skill_level": "beginner"|"intermediate"|"advanced"}'
                )
            ),
            HumanMessage(
                content=(
                    "Derive interview topics and difficulty from this text (includes job description "
                    "and resume when the candidate provided them):\n"
                    f"{knowledge}"
                )
            ),
        ]
    )
    text = text_from_llm_response(raw)
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        data = json.loads(text)
        topics = [str(t) for t in data.get("topics", []) if t][:8]
        level = str(data.get("skill_level", "intermediate")).lower()
        if level not in ("beginner", "intermediate", "advanced"):
            level = "intermediate"
    except (json.JSONDecodeError, TypeError):
        topics = ["general_cs"]
        level = "intermediate"
    if not topics:
        topics = ["general_cs"]
    return {"extracted_topics": topics, "skill_level": level}


def intake_has_enough_for_plan(state: InterviewState) -> bool:
    """LLM gate: is intake rich enough to build an agenda? (Respects min user turns in caller.)"""
    last_user = ""
    for m in reversed(state.get("conversation_history") or []):
        if m.get("role") == "user" and (m.get("content") or "").strip():
            last_user = (m.get("content") or "").strip().lower()
            break
    meta_only = bool(
        last_user
        and any(
            p in last_user
            for p in (
                "what else",
                "anything else",
                "need from me",
                "is that enough",
                "is that all",
                "ready to start",
                "ready to begin",
                "can we start",
                "are we good",
                "good enough",
            )
        )
    )
    if meta_only:
        return False

    llm = get_chat()
    transcript_lines: list[str] = []
    for m in (state.get("conversation_history") or [])[-12:]:
        r, c = m.get("role", ""), (m.get("content") or "").strip()
        if c:
            transcript_lines.append(f"{r}: {c}")
    transcript = "\n".join(transcript_lines)
    raw = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Decide if the mock interview has enough intake to tailor difficulty and topics. "
                    "Need at least: target role or job type, rough experience level or background, "
                    "and one concrete focus (e.g. frontend, ML, new grad). "
                    "You may count clear signals from the optional signup profile (job description, title, resume) "
                    "below as satisfying missing pieces if the transcript is thin but the profile is specific. "
                    "Reply no if they only made small talk, asked what you still need, or repeated the same vague line. "
                    "Reply with exactly one word: yes or no."
                )
            ),
            HumanMessage(
                content=(
                    f"Optional signup profile (may be empty):\n{(state.get('knowledge') or '').strip()[:3000]}\n\n"
                    f"Transcript:\n{transcript[:9000]}"
                )
            ),
        ]
    )
    text = text_from_llm_response(raw).lower()
    return text.startswith("y") or " yes" in text
