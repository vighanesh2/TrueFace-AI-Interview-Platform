"""Light answer-quality signal for routing follow-ups vs pivot."""

from __future__ import annotations

import re

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm_factory import get_chat, text_from_llm_response
from ..state import InterviewState


def evaluate_answer(state: InterviewState) -> dict:
    history = state.get("conversation_history") or []
    last_user = ""
    for m in reversed(history):
        if m.get("role") == "user":
            last_user = m.get("content", "")
            break
    if not last_user.strip():
        return {"last_answer_quality": "shallow"}

    phase = (state.get("phase") or "").lower()
    if phase == "behavioral":
        rubric = (
            "Classify the candidate's last answer in a behavioral interview. "
            "Reply with exactly one word: shallow | adequate | strong. "
            "shallow = one-liner, no situation, or off-topic. "
            "adequate = some context but thin on actions/outcomes. "
            "strong = clear situation, actions, and results (STAR/CAR) or equivalent depth."
        )
    else:
        rubric = (
            "Classify the candidate's last answer for an interview. "
            "Reply with exactly one word: shallow | adequate | strong. "
            "shallow = vague, very short, or off-topic. "
            "adequate = reasonable but thin. strong = specific, structured, technical depth."
        )

    llm = get_chat()
    raw = llm.invoke(
        [
            SystemMessage(content=rubric),
            HumanMessage(content=last_user[:8000]),
        ]
    )
    text = text_from_llm_response(raw).lower()
    m = re.search(r"\b(shallow|adequate|strong)\b", text)
    quality = m.group(1) if m else "adequate"
    out: dict = {"last_answer_quality": quality}
    if (state.get("phase") or "") == "technical":
        out["technical_user_turns"] = int(state.get("technical_user_turns") or 0) + 1
    return out
