"""Advance topic / phase using follow-up depth and answer quality."""

from __future__ import annotations

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

    agenda = state.get("topic_agenda") or {}
    phase = state.get("phase") or "technical"
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
        return {
            "current_topic": nxt,
            "follow_up_depth": 0,
            "current_part_index": _PART_INDEX.get(phase, 1),
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
