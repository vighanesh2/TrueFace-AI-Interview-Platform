"""Interviewer lines: opening and per-turn prompts (short, avatar-friendly)."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm_factory import get_chat, text_from_llm_response
from ..state import InterviewState

_SYSTEM = """You are a senior engineering manager conducting a realistic hiring interview.
Rules:
- ONE clear question or prompt per reply (no bullet lists).
- Keep it under 3 short sentences so text-to-speech sounds natural.
- Warm, professional; optional light humor at most once per few turns.
- Never mention RAG, Pinecone, or that you are an AI."""


def roadmap_and_open_technical(state: InterviewState) -> dict:
    """After intake: natural handoff into technical, then the first technical question."""
    llm = get_chat()
    knowledge = state.get("knowledge", "")
    topic = state.get("current_topic", "")
    ctx = (state.get("retrieved_context") or "")[:6000]
    raw = llm.invoke(
        [
            SystemMessage(content=_SYSTEM),
            HumanMessage(
                content=(
                    "Intake is complete. In ONE reply (no bullet lists, no syllabus tone):\n"
                    "Give a short, warm transition — like you're ready to start the technical portion — "
                    "and lightly mention that later you'll also touch system design and behavioral topics, "
                    "in plain language. Do NOT say how many areas, topics, or questions you will cover. "
                    "Do NOT sound like you're reading a schedule.\n"
                    "Optionally one casual line that coding on an editor may show up later; keep it brief.\n"
                    "Then ask ONE first technical question aligned with topic "
                    f"'{topic}'. It must be CS fundamentals, data structures, or algorithms — "
                    "not system design, scalability, or distributed architecture (save that for later). "
                    "Keep total under 160 words.\n\n"
                    f"Original signup blurb:\n{knowledge}\n\n"
                    f"Reference snippets:\n{ctx}"
                )
            ),
        ]
    )
    text = text_from_llm_response(raw)
    hist = list(state.get("conversation_history") or [])
    hist.append({"role": "assistant", "content": text})
    return {
        "next_response": text,
        "conversation_history": hist,
        "turn_count": int(state.get("turn_count") or 0) + 1,
    }


def generate_reply(state: InterviewState) -> dict:
    llm = get_chat()
    phase = state.get("phase", "technical")
    topic = state.get("current_topic", "")
    ctx = (state.get("retrieved_context") or "")[:6000]
    depth = int(state.get("follow_up_depth") or 0)

    hist_lines: list[str] = []
    for m in (state.get("conversation_history") or [])[-10:]:
        role = m.get("role", "")
        content = m.get("content", "")
        hist_lines.append(f"{role}: {content}")
    transcript = "\n".join(hist_lines)

    if phase == "wrap_up":
        raw = llm.invoke(
            [
                SystemMessage(content=_SYSTEM),
                HumanMessage(
                    content=(
                        "Close the interview kindly in 2 short sentences: "
                        "thank them and say next steps are out of band."
                    )
                ),
            ]
        )
        text = text_from_llm_response(raw)
        hist = list(state.get("conversation_history") or [])
        hist.append({"role": "assistant", "content": text})
        return {
            "next_response": text,
            "conversation_history": hist,
            "turn_count": int(state.get("turn_count") or 0) + 1,
            "interview_done": True,
        }

    part_hint = {
        "technical": "You are in Part 1 — Technical.",
        "system_design": "You are in Part 2 — System design.",
        "behavioral": "You are in Part 3 — Behavioral.",
    }.get(phase, f"Phase: {phase}.")
    follow = "Ask a brief follow-up that goes deeper." if depth else "Ask the next main question for this thread."
    raw = llm.invoke(
        [
            SystemMessage(content=_SYSTEM),
            HumanMessage(
                content=(
                    f"{part_hint} Topic focus: {topic}.\n"
                    f"Reference snippets (may be partial):\n{ctx}\n\n"
                    f"Recent transcript:\n{transcript}\n\n"
                    f"{follow} One question only."
                )
            ),
        ]
    )
    text = text_from_llm_response(raw)
    hist = list(state.get("conversation_history") or [])
    hist.append({"role": "assistant", "content": text})
    return {
        "next_response": text,
        "conversation_history": hist,
        "turn_count": int(state.get("turn_count") or 0) + 1,
    }
