"""Clone corpora (if missing), chunk, embed with Vertex, upsert to Pinecone."""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

from pinecone import Pinecone

from .. import config
from ..llm_factory import get_embeddings
from .parser import load_all_chunks


def _ensure_repo(url: str, dest: Path) -> None:
    if dest.is_dir() and (dest / ".git").is_dir():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "clone", "--depth", "1", url, str(dest)],
        check=True,
        capture_output=True,
        text=True,
    )


def _vector_id(chunk_text: str, source: str, idx: int) -> str:
    h = hashlib.sha256(f"{source}:{idx}:{chunk_text[:200]}".encode()).hexdigest()
    return h[:32]


def _batch(iterable: list, size: int):
    for i in range(0, len(iterable), size):
        yield iterable[i : i + size]


def seed_index() -> int:
    config.require_vertex()
    config.require_pinecone()
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)

    _ensure_repo(config.INTERVIEW_MENTOR_URL, config.INTERVIEW_MENTOR_DIR)
    _ensure_repo(config.BEHAVIORAL_URL, config.BEHAVIORAL_DIR)

    chunks = load_all_chunks(config.INTERVIEW_MENTOR_DIR, config.BEHAVIORAL_DIR)
    if not chunks:
        raise RuntimeError("No chunks parsed — check cloned repos under backend/data/")

    embedder = get_embeddings()
    texts = [c.text for c in chunks]
    embeddings: list[list[float]] = []
    for batch in _batch(texts, 32):
        embeddings.extend(embedder.embed_documents(batch))

    pc = Pinecone(api_key=config.PINECONE_API_KEY)
    if config.PINECONE_HOST:
        host = config.PINECONE_HOST.removeprefix("https://").rstrip("/")
        index = pc.Index(host=host)
    else:
        index = pc.Index(config.PINECONE_INDEX_NAME)

    upserted = 0
    for batch_chunks, batch_emb in zip(_batch(chunks, 64), _batch(embeddings, 64)):
        vectors = []
        for c, vec in zip(batch_chunks, batch_emb):
            vid = _vector_id(c.text, c.source, upserted)
            vectors.append(
                {
                    "id": vid,
                    "values": vec,
                    "metadata": {
                        "text": c.text[:12000],
                        "category": c.category,
                        "topic": c.topic[:512],
                        "source": c.source[:512],
                        "chunk_type": c.chunk_type,
                    },
                }
            )
        index.upsert(vectors=vectors)
        upserted += len(vectors)

    return upserted


def main() -> None:
    n = seed_index()
    print(f"Upserted {n} vectors to Pinecone.", file=sys.stderr)


if __name__ == "__main__":
    main()
