"""LangGraph state for one interview session."""

from __future__ import annotations

from typing import Any, TypedDict


class InterviewState(TypedDict, total=False):
    session_id: str
    knowledge: str
    extracted_topics: list[str]
    skill_level: str
    phase: str
    topic_agenda: dict[str, list[str]]
    current_topic: str
    follow_up_depth: int
    conversation_history: list[dict[str, str]]
    turn_count: int
    retrieved_context: str
    next_response: str
    interview_done: bool
    last_answer_quality: str
    # Structured plan for UI (set when leaving intake)
    roadmap: dict[str, Any]
    current_part_index: int
    # User /turn calls while phase == "technical" (post-intake); gates premature SD transition)
    technical_user_turns: int
