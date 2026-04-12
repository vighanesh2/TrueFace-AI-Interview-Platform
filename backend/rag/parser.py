"""Chunk markdown interview corpora with section boundaries and path-based category."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Chunk:
    text: str
    category: str
    topic: str
    source: str
    chunk_type: str


def _category_from_path(rel: str) -> str:
    lower = rel.lower()
    if "systems-design" in lower or "system-design" in lower:
        return "system_design"
    if "behavioral" in lower or "behavior" in lower:
        return "behavioral"
    if "swe-" in lower or "coding" in lower or "ml-" in lower or "data-" in lower:
        return "technical"
    return "technical"


def _topic_slug(rel: str) -> str:
    stem = Path(rel).stem
    return re.sub(r"[^a-z0-9]+", "_", stem.lower()).strip("_") or "general"


def _split_by_headers(text: str, max_chars: int = 1800) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    current_len = 0
    for line in text.splitlines():
        if line.startswith("## ") and current and current_len > 400:
            parts.append("\n".join(current).strip())
            current = [line]
            current_len = len(line)
        else:
            current.append(line)
            current_len += len(line) + 1
        if current_len >= max_chars and current:
            parts.append("\n".join(current).strip())
            current = []
            current_len = 0
    if current:
        parts.append("\n".join(current).strip())
    return [p for p in parts if len(p) > 80]


def chunk_skill_markdown(path: Path, root: Path) -> list[Chunk]:
    rel = str(path.relative_to(root))
    category = _category_from_path(rel)
    topic = _topic_slug(rel)
    text = path.read_text(encoding="utf-8", errors="replace")
    sections = _split_by_headers(text)
    out: list[Chunk] = []
    for i, sec in enumerate(sections):
        ctype = "rubric" if "rubric" in sec.lower() else "hint" if "hint" in sec.lower() else "playbook"
        out.append(
            Chunk(
                text=sec,
                category=category,
                topic=f"{topic}_{i}",
                source=rel,
                chunk_type=ctype,
            )
        )
    return out


def chunk_behavioral_readme(path: Path, root: Path) -> list[Chunk]:
    rel = str(path.relative_to(root))
    text = path.read_text(encoding="utf-8", errors="replace")
    sections = _split_by_headers(text, max_chars=1600)
    return [
        Chunk(
            text=sec,
            category="behavioral",
            topic=f"behavioral_{i}",
            source=rel,
            chunk_type="questions",
        )
        for i, sec in enumerate(sections)
    ]


def load_all_chunks(interview_mentor_root: Path | None, behavioral_root: Path | None) -> list[Chunk]:
    chunks: list[Chunk] = []
    if interview_mentor_root and interview_mentor_root.is_dir():
        agents = interview_mentor_root / "agents"
        if agents.is_dir():
            for path in agents.rglob("SKILL.md"):
                chunks.extend(chunk_skill_markdown(path, interview_mentor_root))
    if behavioral_root and behavioral_root.is_dir():
        for path in behavioral_root.rglob("*.md"):
            chunks.extend(chunk_behavioral_readme(path, behavioral_root))
    return chunks
