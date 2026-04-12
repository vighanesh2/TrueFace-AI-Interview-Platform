"""Build per-phase topic agendas from extracted topics."""

from __future__ import annotations

import re
from typing import Any

from ..state import InterviewState

_DEFAULT_TECH = ["problem_decomposition", "arrays_hashing", "trees_graphs"]
_EXTRA_TECH = ["complexity_tradeoffs", "concurrency_basics", "testing_and_quality"]
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
_MIN_TECH_TOPICS = 4
_MIN_BEH_TOPICS = 6


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_") or "topic"


def build_agenda(state: InterviewState) -> dict:
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
    for d in _EXTRA_TECH:
        if len(technical) >= _MIN_TECH_TOPICS:
            break
        if d not in seen:
            seen.add(d)
            technical.append(d)
    technical = technical[:10]

    agenda = {
        "technical": technical,
        "system_design": list(_DEFAULT_SD),
        "behavioral": list(_DEFAULT_BEH),
    }
    first = agenda["technical"][0]
    return {
        "topic_agenda": agenda,
        "phase": "technical",
        "current_topic": first,
        "follow_up_depth": 0,
        "current_part_index": 1,
        "technical_user_turns": 0,
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
                    "title": "Part 1 — Technical",
                    "order": 1,
                    "summary": (
                        "Technical discussion and follow-ups; room for coding exercises when an editor is available."
                    ),
                },
                {
                    "id": "system_design",
                    "title": "Part 2 — System design",
                    "order": 2,
                    "summary": "System design discussion tailored to the candidate’s level.",
                },
                {
                    "id": "behavioral",
                    "title": "Part 3 — Behavioral",
                    "order": 3,
                    "summary": "Behavioral and experience questions.",
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
