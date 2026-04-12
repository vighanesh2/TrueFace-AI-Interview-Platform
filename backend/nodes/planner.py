"""Build per-phase topic agendas from extracted topics."""

from __future__ import annotations

import re
from typing import Any

from ..state import InterviewState

_DEFAULT_TECH = ["problem_decomposition", "arrays_hashing", "trees_graphs"]
_DEFAULT_SD = ["api_and_scaling", "caching_rate_limits"]
_DEFAULT_BEH = ["teamwork_conflict", "failure_and_learning"]
_EXTRA_BEH = [
    "leadership_influence",
    "time_pressure_priorities",
    "disagreement_peer_manager",
    "cross_functional_collab",
    "mistake_accountability",
    "customer_conflict",
]
_MIN_BEH_TOPICS = 6


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_") or "topic"


def build_agenda(state: InterviewState) -> dict:
    """Full interview: one conversational technical warmup → coding → system design (no long technical loop)."""
    raw_topics = state.get("extracted_topics") or ["general_cs"]
    seen: set[str] = set()
    technical: list[str] = []
    for t in raw_topics[:8]:
        s = _slug(t)
        if s and s not in seen:
            seen.add(s)
            technical.append(s)
    for d in _DEFAULT_TECH:
        if d not in seen:
            seen.add(d)
            technical.append(d)
    # Single warmup thread, then the router switches to the code editor.
    technical = [technical[0]] if technical else ["general_cs"]

    agenda = {
        "technical": technical,
        "system_design": list(_DEFAULT_SD),
        "behavioral": [],
    }
    first = agenda["technical"][0]
    return {
        "topic_agenda": agenda,
        "phase": "technical",
        "current_topic": first,
        "follow_up_depth": 0,
        "current_part_index": 1,
        "technical_user_turns": 0,
        "single_warmup_then_code": True,
    }


def build_agenda_behavioral_only(state: InterviewState) -> dict:
    """Single-phase behavioral interview: agenda only in behavioral bucket (RAG category behavioral)."""
    raw_topics = state.get("extracted_topics") or ["general_experience"]
    seen: set[str] = set()
    behavioral: list[str] = []
    for t in raw_topics[:8]:
        s = _slug(t)
        if s and s not in seen:
            seen.add(s)
            behavioral.append(s)
    for d in _DEFAULT_BEH:
        if d not in seen:
            seen.add(d)
            behavioral.append(d)
    for d in _EXTRA_BEH:
        if len(behavioral) >= _MIN_BEH_TOPICS:
            break
        if d not in seen:
            seen.add(d)
            behavioral.append(d)
    behavioral = behavioral[:12]
    first = behavioral[0] if behavioral else "teamwork_conflict"
    return {
        "topic_agenda": {"technical": [], "system_design": [], "behavioral": behavioral},
        "phase": "behavioral",
        "current_topic": first,
        "follow_up_depth": 0,
        "current_part_index": 1,
        "technical_user_turns": 0,
        "single_warmup_then_code": False,
    }


def build_agenda_coding_only(state: InterviewState) -> dict:
    """Intake → editor only: no verbal technical or system-design phases."""
    return {
        "topic_agenda": {"technical": [], "system_design": [], "behavioral": []},
        "phase": "technical",
        "current_topic": "coding_practice",
        "follow_up_depth": 0,
        "current_part_index": 1,
        "technical_user_turns": 0,
        "single_warmup_then_code": False,
        "coding_only_interview": True,
    }


def build_roadmap_blob(state: InterviewState) -> dict[str, Any]:
    """Structured plan for APIs / future UI (counts kept out of summaries on purpose)."""
    level = state.get("skill_level") or "intermediate"
    return {
        "roadmap": {
            "skill_level": level,
            "parts": [
                {
                    "id": "technical",
                    "title": "Part 1 — Technical warmup",
                    "order": 1,
                    "summary": "One conversational fundamentals question, then a timed coding exercise in the editor.",
                },
                {
                    "id": "system_design",
                    "title": "Part 2 — System design",
                    "order": 2,
                    "summary": "System design discussion tailored to the candidate’s level.",
                },
            ],
            "closing": "Short wrap-up and thanks at the end.",
        }
    }


def build_roadmap_blob_behavioral(state: InterviewState) -> dict[str, Any]:
    level = state.get("skill_level") or "intermediate"
    return {
        "roadmap": {
            "skill_level": level,
            "parts": [
                {
                    "id": "behavioral",
                    "title": "Behavioral interview",
                    "order": 1,
                    "summary": "STAR/CAR-style prompts grounded in retrieved question banks and follow-ups.",
                },
            ],
            "closing": "Short wrap-up and thanks at the end.",
        }
    }


def build_roadmap_blob_coding(state: InterviewState) -> dict[str, Any]:
    level = state.get("skill_level") or "intermediate"
    return {
        "roadmap": {
            "skill_level": level,
            "parts": [
                {
                    "id": "coding",
                    "title": "Coding exercise",
                    "order": 1,
                    "summary": "Timed problem in the editor; brief feedback when you submit.",
                },
            ],
            "closing": "Short wrap-up after submission.",
        }
    }
