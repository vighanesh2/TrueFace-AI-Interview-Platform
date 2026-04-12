"""Interviewer lines: opening and per-turn prompts (short, avatar-friendly)."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from ..config import CODING_TITLE_STRICT
from ..llm_factory import get_chat, text_from_llm_response
from ..state import InterviewState

_SYSTEM = """You are a senior engineering manager conducting a realistic hiring interview.
Rules:
- ONE clear question or prompt per reply (no bullet lists).
- Keep it under 3 short sentences so text-to-speech sounds natural.
- When the candidate profile includes a job description or target role, anchor your questions to that role: skills, stack, and scenarios implied by the JD (without quoting the JD verbatim).
- Warm, professional; optional light humor at most once per few turns.
- Never mention RAG, Pinecone, or that you are an AI.
- If they ask you to repeat, rephrase, say again, or didn’t catch that: briefly restate your last question or point—no “thank you,” no praise, no pretending they answered.
- If they say something off-topic, nonsensical, or unclear: respond naturally—one short clarifying line or gentle redirect back to the interview—do not thank them for an answer they didn’t give.
- Do not use empty pleasantries (“thanks for sharing,” “great question”) when they have not actually addressed your question."""

_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _extract_json_object(raw: str) -> str | None:
    """Pull the first balanced {...} from model output (handles extra prose / partial fences)."""
    text = _JSON_FENCE.sub("", raw.strip()).strip()
    if not text:
        return None
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    quote = ""
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                in_str = False
        else:
            if c in "\"'":
                in_str = True
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    return None


def _conversation_tail(state: InterviewState, max_messages: int = 10) -> str:
    hist = state.get("conversation_history") or []
    lines: list[str] = []
    for m in hist[-max_messages:]:
        role = str(m.get("role") or "")
        content = str(m.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"{role}: {content[:4000]}")
    return "\n".join(lines)


def _apply_starter_defaults(sc: dict[str, Any]) -> None:
    for k, v in (
        ("python", "def solve():\n    pass\n"),
        ("javascript", "function solve() {\n}\n"),
        ("java", "class Solution {\n    public void solve() {}\n}\n"),
        ("cpp", "#include <vector>\nvoid solve() {}\n"),
        ("go", "package main\nfunc solve() {}\n"),
    ):
        if k not in sc or not str(sc.get(k) or "").strip():
            sc[k] = v


def _parse_problem_json(raw: str) -> dict[str, Any]:
    candidate = _extract_json_object(raw) or _JSON_FENCE.sub("", raw.strip()).strip()
    try:
        data = json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    raw_cases = data.get("test_cases")
    test_cases: list[dict[str, str]] = []
    if isinstance(raw_cases, list):
        for item in raw_cases:
            if not isinstance(item, dict):
                continue
            inp = item.get("input")
            exp = item.get("expected_output", item.get("expected"))
            if inp is not None and exp is not None:
                test_cases.append({"input": str(inp), "expected_output": str(exp)})
    examples_list = data.get("examples") if isinstance(data.get("examples"), list) else []
    if not test_cases and examples_list:
        for item in examples_list:
            if not isinstance(item, dict):
                continue
            inp = item.get("input")
            o = item.get("output")
            if inp is not None and o is not None:
                test_cases.append({"input": str(inp), "expected_output": str(o)})
    out = {
        "title": str(data.get("title") or "Coding exercise"),
        "description": str(data.get("description") or "Solve the problem in the editor."),
        "examples": examples_list,
        "constraints": data.get("constraints") if isinstance(data.get("constraints"), list) else [],
        "starter_code": data.get("starter_code") if isinstance(data.get("starter_code"), dict) else {},
        "time_limit_seconds": int(data.get("time_limit_seconds") or 600),
        "spoken_summary": str(
            data.get("spoken_summary") or "Please use the code editor to solve the problem."
        ),
        "test_cases": test_cases,
    }
    sc = out["starter_code"]
    _apply_starter_defaults(sc)
    return out


def _problem_needs_enrichment(p: dict[str, Any]) -> bool:
    desc = (p.get("description") or "").strip()
    generic_desc = desc in ("", "Solve the problem in the editor.") or len(desc) < 80
    no_tests = not (p.get("test_cases") or [])
    no_examples = not (p.get("examples") or [])
    return generic_desc or no_tests or no_examples


def _enrich_coding_problem(state: InterviewState, problem: dict[str, Any]) -> dict[str, Any]:
    """Second LLM pass when the first returned junk JSON or empty tests (not Pinecone — model output only)."""
    if not _problem_needs_enrichment(problem):
        return problem
    llm = get_chat()
    tail = _conversation_tail(state, 12)
    draft = json.dumps(
        {
            "title": problem.get("title"),
            "description": problem.get("description"),
            "examples": problem.get("examples"),
            "test_cases": problem.get("test_cases"),
        },
        indent=2,
    )[:6000]
    raw = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Reply with ONLY valid JSON, no markdown. Keys: "
                    "title, description (full problem statement the candidate reads), "
                    "examples (array of {input, output, explanation}), "
                    "constraints (string array), "
                    "test_cases (array of 3 to 5 objects, each {input, expected_output} as SHORT strings), "
                    "spoken_summary (under 50 words, natural speech introducing the task). "
                    "The task MUST match what the interviewer asked in the transcript. "
                    "test_cases MUST be non-empty."
                )
            ),
            HumanMessage(
                content=(
                    "Recent interview transcript (anchor the coding task here):\n"
                    f"{tail}\n\n"
                    "Draft JSON from a previous attempt (fix or replace):\n"
                    f"{draft}\n\n"
                    "If the draft is generic or only 'reverse string' / palindrome / FizzBuzz without the transcript "
                    "asking for that, replace with a richer problem that matches the transcript and topic. "
                    "Title and description must name the actual task."
                )
            ),
        ]
    )
    fixed = _parse_problem_json(text_from_llm_response(raw))
    # Merge: prefer enriched non-empty fields
    out = dict(problem)
    if (fixed.get("description") or "").strip() and len(str(fixed.get("description"))) >= len(
        str(out.get("description") or "")
    ):
        out["description"] = fixed["description"]
    if fixed.get("title"):
        out["title"] = fixed["title"]
    if isinstance(fixed.get("examples"), list) and fixed["examples"]:
        out["examples"] = fixed["examples"]
    if isinstance(fixed.get("constraints"), list) and fixed["constraints"]:
        out["constraints"] = fixed["constraints"]
    if isinstance(fixed.get("test_cases"), list) and fixed["test_cases"]:
        out["test_cases"] = fixed["test_cases"]
    if (fixed.get("spoken_summary") or "").strip():
        out["spoken_summary"] = fixed["spoken_summary"]
    if isinstance(fixed.get("starter_code"), dict) and fixed["starter_code"]:
        sc = dict(out.get("starter_code") or {})
        for lang, code in fixed["starter_code"].items():
            if isinstance(code, str) and code.strip():
                sc[str(lang)] = code
        out["starter_code"] = sc
    _apply_starter_defaults(out.setdefault("starter_code", {}))
    return out


def _last_user_content(state: InterviewState) -> str:
    for m in reversed(state.get("conversation_history") or []):
        if m.get("role") == "user":
            return m.get("content") or ""
    return ""


_GENERIC_CODING_TITLES = frozenset(
    {
        "coding exercise",
        "coding problem",
        "algorithm problem",
        "data structures problem",
        "practice problem",
        "leetcode problem",
        "mock problem",
        "dsa problem",
        "interview question",
        "interview coding question",
        "problem",
        "task",
        "exercise",
        "algorithm task",
        "coding task",
        "dsa task",
    }
)


def _is_coding_title_acceptable(title: str) -> bool:
    """Heuristic: real problem names, not parser defaults or filler."""
    t = title.strip()
    if len(t) < 4 or len(t) > 120:
        return False
    tl = t.lower()
    if tl in _GENERIC_CODING_TITLES:
        return False
    if tl.startswith("coding exercise"):
        return False
    return True


def _parse_title_repair_response(raw: str) -> dict[str, str]:
    blob = _extract_json_object(raw) or _JSON_FENCE.sub("", raw.strip()).strip()
    try:
        data = json.loads(blob)
    except (json.JSONDecodeError, TypeError):
        return {}
    if not isinstance(data, dict):
        return {}
    title = str(data.get("title") or "").strip()
    spoken = str(data.get("spoken_summary") or "").strip()
    out: dict[str, str] = {}
    if title:
        out["title"] = title
    if spoken:
        out["spoken_summary"] = spoken
    return out


def _repair_coding_title(state: InterviewState, problem: dict[str, Any]) -> dict[str, str]:
    """Single follow-up call: concrete title + spoken line. Returns {} on failure."""
    llm = get_chat()
    tail = _conversation_tail(state, 10)
    snapshot = json.dumps(
        {
            "title": problem.get("title"),
            "description": (problem.get("description") or "")[:2000],
            "test_cases": problem.get("test_cases"),
        },
        indent=2,
    )[:8000]
    raw = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Reply with ONLY valid JSON, no markdown. Keys: title (string), spoken_summary (string).\n"
                    "title must be a specific interview-style problem name (2–10 words), e.g. "
                    "'Two Sum', 'Longest Increasing Subsequence', 'Course Schedule' — never generic labels like "
                    "'Coding exercise', 'Algorithm problem', or 'Practice task'.\n"
                    "spoken_summary: under 50 words, natural speech introducing that exact problem to the candidate."
                )
            ),
            HumanMessage(
                content=(
                    "Recent interview transcript (problem must match this context):\n"
                    f"{tail}\n\n"
                    "Current problem snapshot (fix only the title/spoken to be specific and accurate):\n"
                    f"{snapshot}"
                )
            ),
        ]
    )
    text = text_from_llm_response(raw)
    return _parse_title_repair_response(text)


def _ensure_coding_title_quality(state: InterviewState, problem: dict[str, Any]) -> dict[str, Any]:
    """
    If title looks generic, run at most one repair pass. On any failure, return original problem unchanged.
    """
    if not CODING_TITLE_STRICT:
        return problem
    title = str(problem.get("title") or "").strip()
    if _is_coding_title_acceptable(title):
        return problem
    try:
        patch = _repair_coding_title(state, problem)
    except Exception:
        return problem
    new_title = patch.get("title", "").strip()
    if not new_title or not _is_coding_title_acceptable(new_title):
        return problem
    out = dict(problem)
    out["title"] = new_title
    if patch.get("spoken_summary"):
        out["spoken_summary"] = patch["spoken_summary"]
    return out


def _coding_problem_variety_hint(state: InterviewState) -> str:
    """Nudge the model away from always picking 'reverse string' while staying transcript-first."""
    turn = int(state.get("turn_count") or 0)
    families = (
        "hash map / frequency counting on arrays or strings",
        "two pointers or sliding window on a linear structure",
        "stack-based parsing, bracket matching, or similar",
        "intervals, merging ranges, or greedy scheduling",
        "BFS/DFS on a grid or small graph, or tree traversal",
        "prefix sums, running aggregates, or subarray logic",
    )
    return families[turn % len(families)]


def _emit_coding_problem(state: InterviewState) -> dict:
    llm = get_chat()
    topic = state.get("current_topic", "")
    ctx = (state.get("retrieved_context") or "")[:6000]
    tail = _conversation_tail(state, 12)
    variety = _coding_problem_variety_hint(state)
    coding_only = bool(state.get("coding_only_interview"))
    system_tail = (
        "There was no separate verbal technical question — use intake (role, languages, goals) plus topic focus.\n"
        "Pick a standard interview-style problem suited to their level, not the shortest toy problem."
        if coding_only
        else (
            "If the verbal question was broad, pick a standard interview-style problem that fits the topic "
            "and transcript, not the shortest string toy problem."
        )
    )
    human_block = (
        (
            f"Topic focus: {topic}.\nReference snippets:\n{ctx}\n\n"
            "Intake and conversation so far (tailor difficulty and problem domain to role, languages, and goals):\n"
            f"{tail}\n\n"
            f"Variety nudge (use ONLY if it fits; transcript wins): consider {variety}.\n\n"
            "Design one concise data-structures/algorithms problem they can implement in the editor. "
            "Include at least 3 test_cases with concrete input and expected_output strings. "
            "Keep description under 220 words."
        )
        if coding_only
        else (
            f"Topic focus: {topic}.\nReference snippets:\n{ctx}\n\n"
            "Recent interview conversation (your coding task MUST follow the last technical question):\n"
            f"{tail}\n\n"
            f"Variety nudge (use ONLY if it fits the transcript and topic; transcript wins): consider "
            f"{variety}.\n\n"
            "Design one concise coding problem (data structures / algorithms) that the candidate can implement "
            "in code — align with what they were just asked verbally. "
            "Include at least 3 test_cases with concrete input and expected_output strings. "
            "Keep description under 220 words."
        )
    )
    raw = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Reply with ONLY valid JSON, no markdown, no commentary before or after. Keys: "
                    "title (string), description (string), examples (array of "
                    '{input, output, explanation}), constraints (string array), '
                    "starter_code (object with keys python, javascript, java, cpp, go — each a starter string), "
                    "test_cases (array of 3 to 5 objects: {input, expected_output} as short strings for automated checks), "
                    "time_limit_seconds (number, default 600), "
                    "spoken_summary (under 50 words: what you will say aloud to introduce the problem).\n"
                    "Quality rules: The title must name the real task (e.g. 'Two Sum', 'Merge Overlapping Intervals'). "
                    "The description must state the full problem—not 'use the editor' boilerplate.\n"
                    "Do NOT default to these clichés unless the conversation literally asked for that exact task: "
                    "reverse a string, palindrome check, FizzBuzz, naive Fibonacci nth, or 'implement strlen'.\n"
                    + system_tail
                )
            ),
            HumanMessage(content=human_block),
        ]
    )
    text = text_from_llm_response(raw)
    problem = _parse_problem_json(text)
    problem = _enrich_coding_problem(state, problem)
    problem = _ensure_coding_title_quality(state, problem)
    hist = list(state.get("conversation_history") or [])
    spoken = problem["spoken_summary"]
    hist.append({"role": "assistant", "content": spoken})
    return {
        "coding_prompt": problem,
        "next_response": spoken,
        "conversation_history": hist,
        "turn_count": int(state.get("turn_count") or 0) + 1,
        "input_mode": "code",
    }


def open_coding_session(state: InterviewState) -> dict:
    """After intake in coding-only mode: structured problem + editor (no verbal technical round)."""
    return _emit_coding_problem(state)


def _evaluate_coding_submission(state: InterviewState) -> dict:
    llm = get_chat()
    problem = state.get("coding_prompt") or {}
    last = _last_user_content(state)
    ctx = (state.get("retrieved_context") or "")[:4000]
    flags = list(state.get("integrity_flags") or [])
    flag_note = ""
    if flags:
        flag_note = (
            "Integrity flags from the practice session (mention conversationally as coaching, not punishment; "
            "this is a mock interview): "
            + ", ".join(flags)
        )
    paste = "heavy_paste" in flags
    sys_add = ""
    if paste:
        sys_add = (
            " The candidate showed paste-like behavior in the editor. Do NOT accuse. "
            "Ask them in one warm sentence to walk through their solution step by step in chat next. "
            "Do NOT ask a new technical topic question yet — that comes after they explain."
        )
    deferred_raw = state.get("deferred_next_topic")
    to_system_design = isinstance(deferred_raw, str) and deferred_raw == ""
    coding_only = bool(state.get("coding_only_interview"))
    if coding_only:
        post_code_instruction = (
            " Keep the reply under 3 short sentences total."
            if paste
            else (
                " In 3–4 short sentences: comment on approach/correctness/complexity, thank them warmly, "
                "and close — this coding practice session is complete. "
                "Do NOT introduce system design, another coding exercise, or further interview phases."
            )
        )
    else:
        post_code_instruction = (
            (
                " In 2–3 short sentences: comment briefly on approach/correctness/complexity. "
                "Then clearly transition to **Part 2 — system design**: one short handoff line, then **one** concrete "
                "system-design question (APIs, scaling, storage, consistency, or reliability). "
                "Do NOT ask another coding or data-structures question."
            )
            if to_system_design and not paste
            else (
                " In 2–3 short sentences: briefly comment on approach/correctness/complexity. "
                "If integrity flags are present (and not the paste walkthrough case above), weave one gentle sentence "
                "that a real proctor might notice. "
                "Then ask ONE short follow-up technical question to continue the interview."
                if not paste
                else " Keep the reply under 3 short sentences total."
            )
        )
    raw = llm.invoke(
        [
            SystemMessage(content=_SYSTEM),
            HumanMessage(
                content=(
                    "The candidate just submitted code for a timed exercise.\n"
                    f"Problem (JSON summary):\n{json.dumps(problem, indent=2)[:8000]}\n\n"
                    f"Candidate submission (transcript excerpt):\n{last[:12000]}\n\n"
                    f"Reference snippets:\n{ctx}\n\n"
                    f"{flag_note}\n\n"
                    + sys_add
                    + post_code_instruction
                )
            ),
        ]
    )
    text = text_from_llm_response(raw)
    hist = list(state.get("conversation_history") or [])
    hist.append({"role": "assistant", "content": text})
    deferred = deferred_raw if isinstance(deferred_raw, str) else ""
    out: dict[str, Any] = {
        "next_response": text,
        "conversation_history": hist,
        "turn_count": int(state.get("turn_count") or 0) + 1,
        "input_mode": "chat",
        "coding_prompt": None,
        "coding_turns_given": int(state.get("coding_turns_given") or 0) + 1,
        "integrity_flags": flags,
        "test_results": None,
    }
    if paste:
        out["awaiting_explanation"] = True
        return out

    if coding_only:
        out["phase"] = "wrap_up"
        out["current_topic"] = "closing"
        out["current_part_index"] = 4
        out["interview_done"] = True
        return out

    if deferred:
        out["current_topic"] = deferred
        out["deferred_next_topic"] = None
        out["follow_up_depth"] = 0
    elif deferred_raw == "":
        agenda = state.get("topic_agenda") or {}
        sd_topics = list(agenda.get("system_design") or [])
        out["phase"] = "system_design"
        out["current_topic"] = sd_topics[0] if sd_topics else "api_and_scaling"
        out["follow_up_depth"] = 0
        out["current_part_index"] = 2
        out["deferred_next_topic"] = None
    return out


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
                    "Give a short, warm transition: they will answer exactly ONE technical question in chat, "
                    "then move straight to a timed coding exercise in the editor, then system design. "
                    "Do NOT stack multiple questions, numbered lists of questions, or 'Part A / Part B' prompts — "
                    "exactly one clear question only.\n"
                    "Then ask that single technical question aligned with topic "
                    f"'{topic}' and the target role / job description when provided. "
                    "It must be CS fundamentals, data structures, or algorithms — "
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


def roadmap_and_open_behavioral(state: InterviewState) -> dict:
    """After intake in behavioral-only mode: handoff + first behavioral question (RAG-backed)."""
    llm = get_chat()
    knowledge = state.get("knowledge", "")
    topic = state.get("current_topic", "")
    ctx = (state.get("retrieved_context") or "")[:6000]
    raw = llm.invoke(
        [
            SystemMessage(content=_SYSTEM),
            HumanMessage(
                content=(
                    "Intake is complete. This is a behavioral-only mock interview.\n"
                    "In ONE reply (no bullet lists): give a short warm transition into behavioral questions — "
                    "mention you'll use STAR or CAR structure when helpful. "
                    "Do NOT mention coding, algorithms, or system design.\n"
                    "Then ask ONE first behavioral question aligned with topic "
                    f"'{topic}' and realistic for the target role / job description when provided. "
                    "Draw themes from the reference snippets when useful. "
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
    knowledge = (state.get("knowledge") or "").strip()
    knowledge_block = (
        f"Candidate profile (from signup; includes job description when provided):\n{knowledge[:4500]}"
        if knowledge
        else "Candidate profile: not provided beyond the transcript."
    )
    ctx = (state.get("retrieved_context") or "")[:6000]
    depth = int(state.get("follow_up_depth") or 0)
    mode = state.get("input_mode") or "chat"
    cp = state.get("coding_prompt")
    last_u = _last_user_content(state)

    if phase == "technical" and mode == "code":
        has_prompt = isinstance(cp, dict) and (
            cp.get("title")
            or cp.get("description")
            or cp.get("examples")
            or cp.get("test_cases")
            or cp.get("starter_code")
        )
        if has_prompt and "[Code submission]" in last_u:
            return _evaluate_coding_submission(state)
        if not has_prompt:
            return _emit_coding_problem(state)
        # coding_prompt exists but last user turn is not a code submission (e.g. API misuse); stay in editor
        spoken = str((cp or {}).get("spoken_summary") or "").strip() or (
            "Continue with the coding task in the editor when you are ready."
        )
        return {
            "next_response": spoken,
            "turn_count": int(state.get("turn_count") or 0) + 1,
            "input_mode": "code",
        }

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
                    f"{knowledge_block}\n\n"
                    f"Reference snippets (may be partial):\n{ctx}\n\n"
                    f"Recent transcript:\n{transcript}\n\n"
                    "Prioritize the candidate’s latest message: if it is a repeat/clarification request or not a real answer, "
                    "handle that first (restate or redirect) instead of advancing.\n"
                    f"{follow} One question only. Tie it to the role/JD when a job description or title was provided."
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
