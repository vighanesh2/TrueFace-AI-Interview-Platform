"""LangGraph state for one interview session."""

from __future__ import annotations

from typing import Any, TypedDict


class InterviewState(TypedDict, total=False):
    session_id: str
    # "full" = technical → system design → behavioral; "behavioral" = behavioral-only mock
    interview_mode: str
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
    # "chat" | "code" — UI shows editor when "code" during technical phase
    input_mode: str
    # Structured problem (LLM JSON): title, description, examples, constraints, starter_code, time_limit_seconds, spoken_summary
    coding_prompt: dict[str, Any]
    code_submissions: list[dict[str, Any]]
    coding_turns_given: int
    integrity_flags: list[str]
    # Next technical topic to apply after a coding challenge completes (set when deferring topic advance)
    deferred_next_topic: str
    # Last automated test run (Gemini checks against problem.test_cases)
    test_results: list[dict[str, Any]]
    # After paste-flagged pass, user must send one chat explanation before topic resumes
    awaiting_explanation: bool
    # "gemini" after automated test evaluation
    last_test_runner: str
