"""Load repo-root .env.local and normalize paths for Vertex credentials."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
# Match Next.js: base `.env`, then `.env.local` overrides (many dev setups only have `.env`).
load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local", override=True)

_cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
if _cred:
    p = Path(_cred)
    if not p.is_absolute():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(REPO_ROOT / _cred.lstrip("./"))

GOOGLE_CLOUD_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_CLOUD_LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or os.environ.get("GEMINI_VERTEX_MODEL") or "gemini-2.5-flash"
# Interview replies (intake + roadmap + questions) need room; 512 often stops mid-sentence on 2.5 models.
GEMINI_MAX_OUTPUT_TOKENS = int(os.environ.get("GEMINI_MAX_OUTPUT_TOKENS", "2048"))
EMBEDDING_MODEL = os.environ.get("VERTEX_EMBEDDING_MODEL", "text-embedding-004")

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "")
PINECONE_HOST = os.environ.get("PINECONE_HOST", "")

# When true (default), weak coding-problem titles trigger one repair LLM call (see generator).
CODING_TITLE_STRICT = os.environ.get("CODING_TITLE_STRICT", "true").lower() in (
    "1",
    "true",
    "yes",
)

DATA_DIR = Path(__file__).resolve().parent / "data"
INTERVIEW_MENTOR_DIR = DATA_DIR / "The-Interview-Mentor"
BEHAVIORAL_DIR = DATA_DIR / "behavioral-interview-list-of-questions"

INTERVIEW_MENTOR_URL = "https://github.com/ps06756/The-Interview-Mentor.git"
BEHAVIORAL_URL = "https://github.com/gregorojstersek/behavioral-interview-list-of-questions.git"


def require_vertex() -> None:
    if not GOOGLE_CLOUD_PROJECT:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is not set")
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS is not set")


def require_pinecone() -> None:
    if not PINECONE_API_KEY:
        raise RuntimeError("PINECONE_API_KEY is not set")
    if not PINECONE_INDEX_NAME and not PINECONE_HOST:
        raise RuntimeError("PINECONE_INDEX_NAME or PINECONE_HOST is required")
