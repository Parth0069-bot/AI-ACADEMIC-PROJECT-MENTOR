# AI Academic Project Mentor — Backend

Milestone 2 backend. Runs separately from the Next.js frontend, as its own Python/FastAPI server. LLM provider: **Gemini** (Google AI Studio — free tier, matches the Task 2 architecture diagram).

**Task 1 (Feasibility Analysis Agent) is complete — all 7 steps.**

## What's built

1. Project skeleton + health check
2. Supabase connection — fetch idea + student skills together
3. Gemini connection (`/debug/gemini-ping`)
4. The actual Feasibility Agent (`app/agents/feasibility_agent.py`)
5. Real endpoint: `POST /agents/feasibility/{idea_id}` — full error handling (404/503/502)
6. Results saved to `agent_feedback` table; `GET /agents/feedback/{idea_id}` reads history back
7. `scripts/validate_feasibility_agent.py` — runs the full live pipeline against real ideas

**New in this version**: CORS middleware, so the frontend's "Analyze Feasibility" button can actually call this backend from the browser. Without it, every request from `localhost:3000` would be silently blocked.

## Setup

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill in `.env`:
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Supabase -> Project Settings -> API -> service_role -- not the anon key)
- `GEMINI_API_KEY` -- free at aistudio.google.com/apikey
- `FRONTEND_ORIGIN` -- leave as http://localhost:3000 unless your frontend runs elsewhere

Run the database migration once: Supabase -> SQL Editor -> paste all of `supabase/migration_step6_agent_feedback.sql` -> Run.

## Run it

```
uvicorn app.main:app --reload
```

Check `http://127.0.0.1:8000/health` -- `supabase_configured` and `gemini_configured` should both say `true`.

## Test it

```
pytest tests/ -v
```
31 tests, all mocked, no real credentials needed.

```
python scripts/validate_feasibility_agent.py <idea-id-1> <idea-id-2> ...
```
Runs the real pipeline against real ideas from your database -- this is Step 7, and the actual proof Task 1 works end to end.

## Project structure
```
app/
  main.py                    -> FastAPI app, CORS, health check
  core/
    config.py, supabase_client.py, gemini_client.py
    idea_repository.py        -> Step 2
    feedback_repository.py    -> Step 6
  agents/feasibility_agent.py -> Step 4
  schemas/                    -> data shapes
  routers/
    debug.py                  -> GET test endpoints
    agents.py                 -> Step 5 + 6: the real endpoints
tests/                        -> 31 tests across every module
scripts/                      -> Step 7 validation script
supabase/                     -> DB migration
```
