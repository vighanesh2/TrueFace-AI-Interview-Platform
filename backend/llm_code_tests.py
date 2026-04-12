"""Evaluate candidate code against simple test cases using Gemini (Vertex)."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from .llm_factory import get_chat, text_from_llm_response

_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _parse_json_object(raw: str) -> dict[str, Any]:
    text = _JSON_FENCE.sub("", raw.strip())
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _normalize_case(tc: Any) -> dict[str, str] | None:
    if not isinstance(tc, dict):
        return None
    inp = tc.get("input")
    exp = tc.get("expected_output", tc.get("expected"))
    if inp is None or exp is None:
        return None
    return {"input": str(inp).strip(), "expected": str(exp).strip()}


def synthesize_test_cases_with_llm(problem: dict[str, Any]) -> list[dict[str, str]]:
    """Generate 3–5 concrete {input, expected_output} rows from title+description only."""
    llm = get_chat()
    prob = json.dumps(
        {
            "title": problem.get("title"),
            "description": (problem.get("description") or "")[:5000],
            "examples": problem.get("examples"),
        },
        indent=2,
    )
    raw = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Reply with ONLY valid JSON, no markdown. Schema:\n"
                    '{"test_cases":[{"input":"short string","expected_output":"short string"}, ...]}\n'
                    "Emit 3 to 5 cases that match the stated problem. Strings only."
                )
            ),
            HumanMessage(content=f"Problem JSON:\n{prob}"),
        ]
    )
    text = text_from_llm_response(raw)
    data = _parse_json_object(text)
    rows = data.get("test_cases")
    if not isinstance(rows, list):
        return []
    out: list[dict[str, str]] = []
    for row in rows:
        n = _normalize_case(row)
        if n:
            out.append({"input": n["input"], "expected_output": n["expected"]})
    return out


def ensure_problem_has_test_cases(problem: dict[str, Any]) -> dict[str, Any]:
    """
    Mutate a shallow copy so `test_cases` is non-empty before grading.
    Order: existing test_cases → examples I/O → LLM synthesis → last-resort sanity row.
    """
    cp = dict(problem)
    collected: list[dict[str, str]] = []

    for t in cp.get("test_cases") or []:
        n = _normalize_case(t)
        if n:
            collected.append({"input": n["input"], "expected_output": n["expected"]})

    if not collected and isinstance(cp.get("examples"), list):
        for ex in cp["examples"]:
            if not isinstance(ex, dict):
                continue
            if ex.get("input") is None or ex.get("output") is None:
                continue
            collected.append(
                {"input": str(ex["input"]).strip(), "expected_output": str(ex["output"]).strip()}
            )

    if not collected:
        collected = synthesize_test_cases_with_llm(cp)

    if not collected:
        collected = [
            {
                "input": "implementation_required",
                "expected_output": "non_trivial_solution",
            }
        ]

    cp["test_cases"] = collected
    return cp


def evaluate_code_with_gemini(
    problem: dict[str, Any],
    code: str,
    language: str,
    test_cases: list[Any],
) -> dict[str, Any]:
    """
    Ask Gemini whether the code satisfies each test case. No code execution.

    Returns:
      all_passed: bool
      test_results: list of {input, expected, actual, passed, note}
      summary_message: short user-facing line
      runner_used: "gemini"
    """
    cases: list[dict[str, str]] = []
    for tc in test_cases:
        n = _normalize_case(tc)
        if n:
            cases.append(n)

    if not cases:
        return {
            "all_passed": False,
            "test_results": [
                {
                    "input": "—",
                    "expected": "—",
                    "actual": "",
                    "passed": False,
                    "note": "No practice test cases were available — cannot verify your submission.",
                }
            ],
            "summary_message": "Practice tests are missing — cannot verify code. Stay in the editor; try submitting again.",
            "runner_used": "gemini",
        }

    llm = get_chat()
    prob_json = json.dumps(
        {
            "title": problem.get("title"),
            "description": (problem.get("description") or "")[:6000],
        },
        indent=2,
    )
    cases_json = json.dumps(
        [{"input": c["input"], "expected_output": c["expected"]} for c in cases],
        indent=2,
    )
    raw = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are a code reviewer. Given a coding problem, candidate source code, "
                    "and test cases (input + expected_output strings), decide for EACH case whether "
                    "the code would produce output matching expected_output when run appropriately. "
                    "Reply with ONLY valid JSON, no markdown. Schema:\n"
                    '{"results":[{"index":0,"passed":true,"actual":"what stdout or return would be","note":"one short reason"}]}\n'
                    "Use the same number of results as test cases, indexes 0..n-1. "
                    "Be strict: if unsure, passed=false."
                )
            ),
            HumanMessage(
                content=(
                    f"Language: {language}\n\n"
                    f"Problem:\n{prob_json}\n\n"
                    f"Test cases:\n{cases_json}\n\n"
                    f"Candidate code:\n```{language}\n{code[:20000]}\n```\n"
                )
            ),
        ]
    )
    text = text_from_llm_response(raw)
    data = _parse_json_object(text)
    rows = data.get("results")
    if not isinstance(rows, list):
        rows = []

    def _idx_val(r: dict[str, Any]) -> int:
        try:
            return int(r.get("index", -1))
        except (TypeError, ValueError):
            return -1

    test_results: list[dict[str, Any]] = []
    all_passed = True
    for i, tc in enumerate(cases):
        passed = False
        actual = ""
        note = "Could not evaluate."
        found = False
        for r in rows:
            if not isinstance(r, dict):
                continue
            if _idx_val(r) != i:
                continue
            found = True
            passed = bool(r.get("passed"))
            actual = str(r.get("actual") or "").strip()
            note = str(r.get("note") or "").strip() or note
            break
        if not found:
            passed = False
            note = "Model did not return a result for this case."
        if not passed:
            all_passed = False
        test_results.append(
            {
                "input": tc["input"],
                "expected": tc["expected"],
                "actual": actual,
                "passed": passed,
                "note": note,
            }
        )

    failed = sum(1 for t in test_results if not t["passed"])
    if not test_results:
        all_passed = True
        summary = "No cases to run."
    elif all_passed:
        summary = f"All {len(test_results)} practice test cases passed."
    else:
        summary = f"{failed} of {len(test_results)} practice test cases failed — fix and resubmit."

    return {
        "all_passed": all_passed,
        "test_results": test_results,
        "summary_message": summary,
        "runner_used": "gemini",
    }
