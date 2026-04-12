"""Dense retrieval from Pinecone scoped by interview phase."""

from __future__ import annotations

from ..llm_factory import get_embeddings
from ..pinecone_store import query_similar
from ..state import InterviewState

_PHASE_CATEGORY = {
    "intro": "technical",
    "technical": "technical",
    "system_design": "system_design",
    "behavioral": "behavioral",
    "wrap_up": "behavioral",
}


def retrieve_context(state: InterviewState) -> dict:
    phase = state.get("phase") or "technical"
    if phase == "intake":
        return {"retrieved_context": ""}
    category = _PHASE_CATEGORY.get(phase, "technical")
    topic = state.get("current_topic") or ""
    history = state.get("conversation_history") or []
    last_user = ""
    for m in reversed(history):
        if m.get("role") == "user":
            last_user = m.get("content", "")
            break
    if not last_user.strip():
        last_user = (state.get("knowledge") or "")[:1500]
    query_text = f"{phase} {topic} {last_user}".strip()[:2000]
    try:
        emb = get_embeddings().embed_query(query_text)
        ctx = query_similar(emb, category=category, top_k=5)
    except Exception:
        ctx = ""
    return {"retrieved_context": ctx}
