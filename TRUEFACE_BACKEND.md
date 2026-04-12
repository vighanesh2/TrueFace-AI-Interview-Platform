# TRUEFACE — Backend orchestration (your scope)

This document captures what we agreed on: **FastAPI + LangGraph + dense-vector RAG** as the interview “brain,” with the HeyGen avatar and MongoDB living in teammates’ code.

## Product split

| Area | Owner | Role |
|------|--------|------|
| Interview brain (adaptive questions, phases, RAG) | You | Python backend |
| Frontend + avatar (speak responses) | Teammate | Next.js + HeyGen LiveAvatar |
| User data + interaction persistence | Teammate | MongoDB |
| Dashboard / analytics | Teammate | Consumes session state from your API |

**Integration:** Frontend calls your HTTP API; dashboard can call `GET /session/{id}/state`. You do **not** need to implement MongoDB or the avatar SDK in this slice.

## Repo workflow

- **Build the `backend/` first**, test with curl/Postman. Then **pull** teammate frontend changes when wiring URLs.
- New Python code lives under `backend/` so it rarely conflicts with Next.js work.

## Stack

- **API:** FastAPI + uvicorn
- **Orchestration:** LangChain + **LangGraph** (explicit phases and routing)
- **LLM + embeddings:** **Vertex AI** via service account JSON (`GOOGLE_APPLICATION_CREDENTIALS`), not the AI Studio API key path
- **Default chat model:** `gemini-2.5-flash` (configurable; lower latency for avatar TTS). Override with `GEMINI_MODEL=gemini-2.5-pro` if you need heavier reasoning.
- **Vector DB:** Pinecone (shared index for the team), **dense** vectors, **768** dimensions, **cosine**, custom index (you embed in Python; do not rely on Pinecone-hosted embedding models for v1)

## Environment variables (reference)

Values live in **`.env.local`** at the repo root (gitignored). **Do not commit secrets.**

| Variable | Purpose |
|----------|---------|
| `HEYGEN_API_KEY` | LiveAvatar token route (Next.js) |
| `GEMINI_API_KEY` | Optional; not used by `/api/chat` when using Vertex (AI Studio only) |
| `GEMINI_VERTEX_MODEL` | Optional alias for `GEMINI_MODEL` (same value: e.g. `gemini-2.5-flash`) |
| `VERTEX_EMBEDDING_MODEL` | Optional; default `text-embedding-004` (768-dim; matches Pinecone index) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Vertex service account `.json` |
| `GOOGLE_CLOUD_PROJECT` | GCP project id |
| `GOOGLE_CLOUD_LOCATION` | e.g. `us-central1` |
| `GEMINI_MODEL` | e.g. `gemini-2.5-flash` |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX_NAME` | Index name |
| `PINECONE_HOST` | Index host URL (optional but useful for clients) |

**Python:** Load env from the **parent** directory (`HackDartmouthXI/.env.local`) or copy/sync into `backend/.env` locally — pick one convention for the team.

## API contract (target)

- **`POST /session/start`** — Body: `{ "knowledge": "<free text: what they know>" }`. Returns `session_id`, first `response` (short text for avatar), `phase`, etc.
- **`POST /session/{session_id}/turn`** — Body: `{ "answer": "..." }`. Returns next `response`, `phase`, `turn`, `topic`, etc.
- **`GET /session/{session_id}/state`** — Full state for dashboard (history, phases, topics, any scores you add later).

Enable **CORS** for the Next.js origin, or teammate proxies through Next.js.

## Interview flow (LangGraph)

**Phases (order):** intro → technical → system_design → behavioral → wrap_up

**Routing ideas:**

- Shallow answer + `follow_up_depth` &lt; cap → drill deeper
- Topic exhausted or enough follow-ups → next topic in agenda
- Phase agenda done → next phase
- All phases done → wrap up

**State** should include at least: `session_id`, raw `knowledge`, `extracted_topics`, `skill_level`, `phase`, `topic_agenda`, `current_topic`, `follow_up_depth`, `conversation_history`, `turn_count`, `retrieved_context`, `next_response`.

## Datasets (RAG corpus)

**Primary — [The Interview Mentor](https://github.com/ps06756/The-Interview-Mentor)** (MIT)

- ~40 `SKILL.md` files under `agents/`
- Covers **technical (coding)** and **system design** deeply; also some behavioral / other tracks
- Content is already written as **interviewer behavior** (phases, follow-ups, hints, rubrics) — ideal for retrieval

**Supplement — [Behavioral interview questions](https://github.com/gregorojstersek/behavioral-interview-list-of-questions)**

- STAR-oriented question list in markdown

**Optional breadth — [LeetCode problems JSON](https://github.com/neenza/leetcode-problems)**

- Filter a **subset** by topic/difficulty if you need more coding variety; avoid embedding all ~3k problems blindly

**Loading (you do not hand-clone unless you want to):** A `loader` script **`git clone`s** the repos into `backend/data/` (gitignored), `parser` chunks the files, `embedder` embeds with Vertex, then vectors are **upserted to Pinecone**. Run that **once** (or when the corpus changes) to seed the index. **At interview runtime**, the API only **queries Pinecone** — no Git access required on the server after indexing.

## RAG approach

Use **regular dense-vector RAG** (Gemini embeddings + Pinecone similarity). **Not** Graph RAG or vectorless-only for v1 — complexity vs. payoff is poor for this corpus size.

What matters:

- **Chunk by section** (mission, phases, hints, rubrics) — avoid huge single chunks
- **Rich metadata** on each vector: `category` (`technical` | `system_design` | `behavioral`), `topic`, `source`, `chunk_type`, etc.
- **Filtered retrieval:** pass `phase` / topic from LangGraph into the query so you don’t pull irrelevant skills

## Cost note (Vertex)

Rough order of magnitude: **Flash** is cheap and fast per interview session; **Pro** is still affordable at hackathon-scale test volume but slower (worse for avatar latency). See [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing).

## Implementation order

1. Scaffold `backend/`: `requirements.txt`, venv, `config.py`, `main.py` + health check  
2. `state.py` + LangGraph skeleton in `graph.py`  
3. RAG: `parser.py`, `embedder.py`, `loader.py` → seed Pinecone  
4. Nodes: intake, planner, retriever, generator  
5. Evaluator + router + conditional edges  
6. Wire session store + `/session/start`, `/session/turn`, `/session/state`  
7. End-to-end tests (curl/Postman)  
8. Persona polish, edge cases  

## Python dependencies (baseline)

Install current versions when you bootstrap; pin in `requirements.txt` for the team after verification:

- `fastapi`, `uvicorn`, `python-dotenv`
- `langchain`, `langgraph`, `langchain-google-vertexai` (Vertex path)
- `pinecone` (v6 client per current Pinecone SDK naming)

## Security

- Service account JSON and `.env.local` must stay **gitignored**
- Rotate any key that was ever committed or pasted in chat

## Running locally (from repo root)

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
backend/.venv/bin/python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Seed Pinecone (clones corpora under `backend/data/`, calls Vertex embeddings, upserts vectors):

```bash
backend/.venv/bin/python -m backend.rag.loader
```

---

*Last updated from team discussion — treat this as the living checklist for the Python orchestration slice.*
