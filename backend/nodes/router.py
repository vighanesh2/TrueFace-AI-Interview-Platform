"""Advance topic / phase using follow-up depth and answer quality."""

from __future__ import annotations

from typing import Any

from ..state import InterviewState

_PHASE_ORDER = ["technical", "system_design", "behavioral", "wrap_up"]
_PART_INDEX = {"technical": 1, "system_design": 2, "behavioral": 3, "wrap_up": 4}
# Require this many user /turn replies while still in technical before SD can start.
_MIN_USER_TURNS_BEFORE_SYSTEM_DESIGN = 3


def _next_in_list(items: list[str], current: str) -> str | None:
    try:
        i = items.index(current)
    except ValueError:
        return items[0] if items else None
    if i + 1 < len(items):
        return items[i + 1]
    return None


def advance_cursor(state: InterviewState) -> dict:
    if state.get("interview_done"):
        return {}

    if state.get("awaiting_explanation"):
        hist = state.get("conversation_history") or []
        last_u = ""
        for m in reversed(hist):
            if m.get("role") == "user":
                last_u = m.get("content") or ""
                break
        if "[Code submission]" not in last_u:
            out: dict[str, Any] = {"awaiting_explanation": False, "follow_up_depth": 0}
            deferred_raw = state.get("deferred_next_topic")
            if isinstance(deferred_raw, str) and deferred_raw:
                out["current_topic"] = deferred_raw
                out["deferred_next_topic"] = None
            elif deferred_raw == "":
                agenda = state.get("topic_agenda") or {}
                sd_topics = list(agenda.get("system_design") or [])
                out["phase"] = "system_design"
                out["current_topic"] = sd_topics[0] if sd_topics else "api_and_scaling"
                out["follow_up_depth"] = 0
                out["current_part_index"] = 2
                out["deferred_next_topic"] = None
            return out

    phase = state.get("phase") or "technical"
    if phase == "technical" and (state.get("input_mode") or "chat") == "code":
        hist = state.get("conversation_history") or []
        last_u = ""
        for m in reversed(hist):
            if m.get("role") == "user":
                last_u = m.get("content") or ""
                break
        if "[Code submission]" in last_u and state.get("coding_prompt"):
            return {}

    agenda = state.get("topic_agenda") or {}
    topic = state.get("current_topic") or ""
    depth = int(state.get("follow_up_depth") or 0)
    quality = state.get("last_answer_quality") or "adequate"

    if phase == "intake":
        return {}

    if phase == "wrap_up":
        return {"interview_done": True, "follow_up_depth": 0, "current_part_index": 4}

    if depth < 2 and quality == "shallow":
        return {"follow_up_depth": depth + 1}
    if depth < 1 and quality == "adequate":
        return {"follow_up_depth": depth + 1}

    phase_topics = list(agenda.get(phase) or [])
    if phase == "technical" and not phase_topics:
        return {
            "current_topic": topic or "general_cs",
            "follow_up_depth": min(depth + 1, 2),
            "current_part_index": 1,
        }

    nxt = _next_in_list(phase_topics, topic)
    if nxt:
        if (
            phase == "technical"
            and int(state.get("coding_turns_given") or 0) < 1
            and (state.get("input_mode") or "chat") == "chat"
        ):
            return {
                "input_mode": "code",
                "follow_up_depth": 0,
                "current_part_index": _PART_INDEX.get(phase, 1),
                "deferred_next_topic": nxt,
            }
        return {
            "current_topic": nxt,
            "follow_up_depth": 0,
            "current_part_index": _PART_INDEX.get(phase, 1),
        }

    if (
        phase == "technical"
        and phase_topics
        and topic == phase_topics[-1]
        and int(state.get("coding_turns_given") or 0) < 1
        and (state.get("input_mode") or "chat") == "chat"
        and int(state.get("technical_user_turns") or 0) >= 2
    ):
        return {
            "input_mode": "code",
            "follow_up_depth": 0,
            "current_part_index": _PART_INDEX.get(phase, 1),
            "deferred_next_topic": "",
        }

    if phase == "technical":
        tech_turns = int(state.get("technical_user_turns") or 0)
        if tech_turns < _MIN_USER_TURNS_BEFORE_SYSTEM_DESIGN:
            anchor = phase_topics[-1] if phase_topics else (topic or "general_cs")
            return {
                "current_topic": anchor,
                "follow_up_depth": min(depth + 1, 2),
                "current_part_index": 1,
            }

    idx = _PHASE_ORDER.index(phase) if phase in _PHASE_ORDER else 0
    if idx + 1 >= len(_PHASE_ORDER):
        return {
            "phase": "wrap_up",
            "current_topic": "closing",
            "follow_up_depth": 0,
            "current_part_index": 4,
        }

    next_phase = _PHASE_ORDER[idx + 1]
    ntopics = agenda.get(next_phase) or []
    return {
        "phase": next_phase,
        "current_topic": ntopics[0] if ntopics else "general",
        "follow_up_depth": 0,
        "current_part_index": _PART_INDEX.get(next_phase, 1),
    }
