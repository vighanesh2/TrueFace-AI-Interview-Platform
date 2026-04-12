# Code-Editor branch: GitHub integration notes

This document records **what was done on Git/GitHub** when landing the **coding-session feature** (LangGraph brain + Gemini practice tests + Monaco UI) on the shared repo, including **rebase**, **conflict resolution**, **routes**, and **files touched**.

Repository: [bharaths27/HackDartmouthXI](https://github.com/bharaths27/HackDartmouthXI)  
Feature branch on GitHub: **`Code-Editor`**  
Local author used for commits: **Sri Ram Swaminathan** / `Srs6500@users.noreply.github.com` (local `git config` only).

---

## What we pushed

Updates were pushed with:

```bash
git push origin main:Code-Editor --force-with-lease
```

That updates the remote ref **`Code-Editor`** to match the local branch that contained the rebased work (after `origin/main` was integrated). `--force-with-lease` avoids clobbering the remote if someone else pushed in the meantime.

**Important:** Force-updating a shared branch should be coordinated with the team.

---

## Commit history (feature stack on top of `origin/main`)

After rebasing onto **`248480b`** (“brought back the landing page”), the branch had this **linear** sequence at the tip:

| Commit     | Summary |
|-----------|---------|
| `8c67297` | **feat(backend): Gemini code tests and /turn gating** — `backend/llm_code_tests.py`, `backend/state.py`, `backend/main.py` |
| `360a7a6` | **feat(backend): graph nodes for coding prompts and explanation deferral** — `backend/nodes/generator.py`, `router.py`, `evaluator.py` |
| `5ef77f7` | **feat(ui): Monaco coding workspace and interview layout** — new components, `package.json` / lockfile, `app/page.tsx`, **`app/code-interview/`** |
| `6d161d4` | **docs: extend TRUEFACE backend notes for coding session fields** — `TRUEFACE_BACKEND.md` |
| `a720aba` | **docs: document /code-interview route for LangGraph mock UI** — `TRUEFACE_BACKEND.md` |

(Exact SHAs may differ if history is rewritten again; use `git log Code-Editor` on an up-to-date clone to verify.)

---

## Rebase vs merging `main` into the branch

**Neither is universally “better”; both integrate teammate work.**

| Approach | Effect |
|----------|--------|
| **`git merge origin/main`** | Adds a **merge commit**. Preserves exact branch history; graph shows a fork and join. |
| **`git rebase origin/main`** | **Replays** your commits on top of latest `main`. History is a straight line; often easier to read in PRs. |

We used **rebase** so the feature commits sit **on top of current `main`**, which matches what many teams prefer before opening a PR. A **merge** would have produced the **same combined tree** after conflict resolution—only the **shape of history** differs.

---

## Why `/code-interview` exists (not only `/`)

After rebase, **`app/page.tsx` on `main`** was already the **marketing landing** (`AuroraHero`), not the full LangGraph + LiveAvatar + Monaco page.

**Conflict:** our feature had put that full flow on **`/`**; `main` had put the landing on **`/`**.

**Resolution:**

- **`/`** — keep **teammate landing** (Aurora).
- **`/code-interview`** — **full** direct-to-FastAPI mock (same behavior as the old single `page.tsx`, moved to a dedicated route).

So seeing **updated teammate UI** at **`/`** is expected: **rebase brought in their commits** from `origin/main`.

**Other routes (teammate flows):** e.g. **`/dashboard/interview`** uses `LiveAvatarInterview` and Next.js API proxies (`/api/interview-brain/*`)—a different integration path than **`/code-interview`**.

---

## Files added or changed (inventory)

### Backend

| Path | Role |
|------|------|
| `backend/llm_code_tests.py` | **New.** Synthesize/fill `test_cases`, Gemini-based grading (no sandboxed execution). |
| `backend/state.py` | Extended state: `test_results`, `awaiting_explanation`, `last_test_runner`, etc. |
| `backend/main.py` | Imports `datetime`/`timezone` and `Literal`; `StartBody.mode`; on code submit, run tests and **early-return** `TurnResponse` when tests fail. |
| `backend/nodes/generator.py` | Coding prompt shape, `test_cases`, explain-your-solution step. |
| `backend/nodes/router.py` | Code mode / `awaiting_explanation` / deferred resume. |
| `backend/nodes/evaluator.py` | **Merged** behavioral rubric (from `main`) with **code-submission hint** when `[Code submission]` appears in the user message. |

### Frontend

| Path | Role |
|------|------|
| `components/code-editor.tsx` | **New.** Monaco panel, language select, timer, keystroke/paste/blur heuristics, test result list. |
| `components/coding-problem-panel.tsx` | **New.** Problem statement + examples + constraints UI. |
| `app/page.tsx` | **Landing only** after integration (Aurora)—aligned with post-rebase `main`. |
| `app/code-interview/page.tsx` | **New.** Client page: original “Mock Live” + coding layout (LangGraph via `NEXT_PUBLIC_INTERVIEW_API_URL` / default `127.0.0.1:8000`). |
| `app/code-interview/layout.tsx` | **New.** Route metadata for the coding mock. |
| `package.json` / `package-lock.json` | e.g. `@monaco-editor/react` (and any lockfile churn from `main`). |

### Docs

| Path | Role |
|------|------|
| `TRUEFACE_BACKEND.md` | API/flow notes for coding session fields; section on **`/code-interview`**. |

### Not committed (by design in that session)

- `.cursor/rules/*`, `__pycache__/`, secrets / `.env.local`.

---

## Merge / rebase conflict resolutions (summary)

1. **`backend/main.py`** — Combine `HEAD`’s `Literal` + `StartBody.mode` with our **datetime** imports and **test-gating** block in `/session/{id}/turn`.
2. **`backend/nodes/evaluator.py`** — Keep **behavioral** vs **technical** rubric split from `main`; append **code submission** hint for non-behavioral phases when the user message includes `[Code submission]`.
3. **`app/page.tsx`** — Keep **`HEAD`** landing; **do not** embed the giant client interview here. Moved interview UI to **`app/code-interview/page.tsx`** (content sourced from the pre-rebase `app/page.tsx` commit).

---

## Recovery work (local workspace)

Some files were **missing** after a partial stash (`backend/llm_code_tests.py`, `components/code-editor.tsx`, `components/coding-problem-panel.tsx`) while `backend/main.py` still imported the test module—tree was **broken** until those files were restored/recreated.

---

## How to run the coding mock locally

1. **FastAPI:** e.g. `python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`
2. **Next.js:** `npm run dev`
3. Open **`http://localhost:3000/code-interview`**  
   Set **`NEXT_PUBLIC_INTERVIEW_API_URL`** in `.env.local` if the API is not the default.

---

## Known follow-ups (environment / robustness)

- **Production build:** `next build` on some `main` snapshots may fail if **`pdf-parse`** (or similar) is missing for `app/api/parse-resume`—that is **orthogonal** to the coding feature; fix deps or imports separately.
- **API shape vs UI:** fields like `coding_prompt.constraints` may arrive as **non-strings** (e.g. arrays) from the LLM. The UI should **coerce to string** before `.trim()` to avoid runtime errors—that is normal **defensive UI**, not caused by rebase.

---

## Quick reference: which page is “mine”?

| URL | What you see |
|-----|----------------|
| `/` | Teammate **landing** (Aurora). |
| `/code-interview` | **Your** LangGraph + Monaco + direct FastAPI mock. |
| `/dashboard/interview` | Dashboard **LiveAvatar** flow (different wiring). |

---

*Last updated to match the Code-Editor integration session (spring 2026). Update this file if the team moves routes or changes the primary integration path.*
