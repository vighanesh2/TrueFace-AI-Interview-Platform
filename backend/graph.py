"""LangGraph workflows for session start and interview turns."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes.evaluator import evaluate_answer
from .nodes.generator import generate_reply
from .nodes.intake import opening_intake
from .nodes.intake_turn import intake_turn
from .nodes.retriever import retrieve_context
from .nodes.router import advance_cursor
from .state import InterviewState


def _compile_start():
    g = StateGraph(InterviewState)
    g.add_node("opening_intake", opening_intake)
    g.add_edge(START, "opening_intake")
    g.add_edge("opening_intake", END)
    return g.compile()


def _route_turn(state: InterviewState) -> str:
    if (state.get("phase") or "") == "intake":
        return "intake_turn"
    return "retrieve_context"


def _compile_turn():
    g = StateGraph(InterviewState)
    g.add_node("intake_turn", intake_turn)
    g.add_node("retrieve_context", retrieve_context)
    g.add_node("evaluate_answer", evaluate_answer)
    g.add_node("advance_cursor", advance_cursor)
    g.add_node("generate_reply", generate_reply)
    g.add_conditional_edges(
        START,
        _route_turn,
        {"intake_turn": "intake_turn", "retrieve_context": "retrieve_context"},
    )
    g.add_edge("intake_turn", END)
    g.add_edge("retrieve_context", "evaluate_answer")
    g.add_edge("evaluate_answer", "advance_cursor")
    g.add_edge("advance_cursor", "generate_reply")
    g.add_edge("generate_reply", END)
    return g.compile()


_start_workflow = _compile_start()
_turn_workflow = _compile_turn()


def run_session_start(state: InterviewState) -> InterviewState:
    return _start_workflow.invoke(state)


def run_session_turn(state: InterviewState) -> InterviewState:
    return _turn_workflow.invoke(state)
