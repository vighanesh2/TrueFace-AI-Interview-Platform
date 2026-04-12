"""Shared Vertex chat + embedding clients."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from langchain_google_vertexai import ChatVertexAI, VertexAIEmbeddings

from . import config


def text_from_llm_response(msg: Any) -> str:
    """Vertex/Gemini may return `content` as a str or a list of text parts; normalize to one string."""
    if msg is None:
        return ""
    c = getattr(msg, "content", msg)
    if isinstance(c, str):
        return c.strip()
    if isinstance(c, list):
        parts: list[str] = []
        for block in c:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                t = block.get("text")
                if isinstance(t, str):
                    parts.append(t)
            else:
                parts.append(str(block))
        return "".join(parts).strip()
    return str(c).strip() if c is not None else ""


@lru_cache(maxsize=1)
def get_chat() -> ChatVertexAI:
    config.require_vertex()
    return ChatVertexAI(
        model_name=config.GEMINI_MODEL,
        project=config.GOOGLE_CLOUD_PROJECT,
        location=config.GOOGLE_CLOUD_LOCATION,
        temperature=0.55,
        max_output_tokens=config.GEMINI_MAX_OUTPUT_TOKENS,
    )


@lru_cache(maxsize=1)
def get_embeddings() -> VertexAIEmbeddings:
    config.require_vertex()
    return VertexAIEmbeddings(
        model_name=config.EMBEDDING_MODEL,
        project=config.GOOGLE_CLOUD_PROJECT,
        location=config.GOOGLE_CLOUD_LOCATION,
    )
