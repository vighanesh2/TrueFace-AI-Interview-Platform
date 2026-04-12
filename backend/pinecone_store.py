"""Pinecone index handle + query helper."""

from __future__ import annotations

from functools import lru_cache

from pinecone import Pinecone

from . import config


@lru_cache(maxsize=1)
def get_index():
    config.require_pinecone()
    pc = Pinecone(api_key=config.PINECONE_API_KEY)
    if config.PINECONE_HOST:
        host = config.PINECONE_HOST.removeprefix("https://").rstrip("/")
        return pc.Index(host=host)
    return pc.Index(config.PINECONE_INDEX_NAME)


def query_similar(
    vector: list[float],
    *,
    category: str,
    top_k: int = 5,
) -> str:
    try:
        idx = get_index()
        res = idx.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True,
            filter={"category": {"$eq": category}},
        )
    except Exception:
        return ""
    if isinstance(res, dict):
        matches = res.get("matches") or []
    else:
        matches = getattr(res, "matches", None) or []
    texts: list[str] = []
    for match in matches or []:
        meta = getattr(match, "metadata", None) or (match.get("metadata") if isinstance(match, dict) else {}) or {}
        t = meta.get("text") if isinstance(meta, dict) else None
        if t:
            texts.append(str(t))
    return "\n\n---\n\n".join(texts)[:12000]
