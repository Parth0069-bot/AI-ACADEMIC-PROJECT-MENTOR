# AI Academic Project Mentor — Backend

Milestone 2 backend. Runs separately from the Next.js frontend, as its own Python/FastAPI server. LLM provider: **Gemini** (Google AI Studio — free tier, matches the Task 2 architecture diagram).

**Tasks 1-6 are all complete** (Feasibility, Scope, Technology, Timeline agents; Supabase persistence; full-chain validation).

## What's built

1. Project skeleton + health check
2. Supabase connection — fetch idea + student skills together
3. Gemini connection (`/debug/gemini-ping`)
4. Four chained agents (`app/agents/`):
   - `feasibility_agent.py` — Task 1. Judges whether the student/team can realistically build this.
   - `scope_agent.py` — Task 2. Reads Feasibility's result, defines what's in/out of scope.
   - `technology_agent.py` — Task 3. Reads Scope's result, recommends a concrete tech stack.
   - `timeline_agent.py` — Task 4. Reads Scope + Technology's results, produces a week-by-week plan.
5. Real endpoints, one per agent, all POST, all with full error handling (400/404/503/502):
   - `POST /agents/feasibility/{idea_id}`
   - `POST /agents/scope/{idea_id}` — 400 if Feasibility hasn't been run yet
   - `POST /agents/technology/{idea_id}` — 400 if Scope hasn't been run yet
   - `POST /agents/timeline/{idea_id}` — 400 if Scope or Technology haven't been run yet
6. Every run is saved to `agent_feedback` (shared columns + a `details` JSONB column holding that agent's full structured result — this is what lets the next agent in the chain read the previous one back). `GET /agents/feedback/{idea_id}` reads the full history.
7. `scripts/validate_feasibility_agent.py` — Task 1's own validation script
8. `scripts/validate_full_pipeline.py` — **Task 6**. Runs all 4 agents in order per idea and checks the whole chain, not just each stage in isolation.

CORS middleware is on, so the frontend's agent buttons can call this backend from the browser. Without it, every request from `localhost:3000` would be silently blocked.

**Agents must be run in order** (Feasibility -> Scope -> Technology -> Timeline) for a given idea — each one reads the previous agent's stored `details` to ground its own reasoning, rather than re-deriving context from scratch.

### Missing-input handling

If a student leaves a field blank at submission — most importantly `tech_stack` for the Technology agent, or `duration` for the Timeline agent — that agent now:
- lists the blank field(s) in a `missing_inputs` array in its result
- says so explicitly in its own `reasoning` (e.g. "no tech stack was proposed at submission")
- caps `confidence_score` at 60 or below, since it's filling a gap rather than validating something the student gave it
- still produces a complete, concrete suggestion (a real stack, a real week-by-week plan) — it's labeled as an AI suggestion, not withheld

The frontend surfaces this as an amber "Not provided at submission" callout above the AI's suggested content, so it's unmistakable which parts came from the student and which the AI filled in.

### Model / billing

`GEMINI_MODEL` in `.env` controls which Gemini model every agent calls (default `gemini-2.5-flash`). If your Google AI Studio account requires billing for that model, override it with a free-tier one, e.g. `GEMINI_MODEL=gemini-2.0-flash-lite` — no code changes needed.

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

Run both database migrations once, in order, in Supabase -> SQL Editor:
1. `supabase/migration_step6_agent_feedback.sql`
2. `supabase/migration_step7_scope_technology_timeline.sql` — adds the `details` column the 3 new agents need

## Run it

```
uvicorn app.main:app --reload
```

Check `http://127.0.0.1:8000/health` -- `supabase_configured` and `gemini_configured` should both say `true`.

## Test it

```
pytest tests/ -v
```
69 tests, all mocked, no real credentials needed — covers every agent's parsing logic plus every endpoint's chaining rules (400s when a prior stage is missing, 502s on bad model output, etc).

```
python scripts/validate_feasibility_agent.py <idea-id-1> <idea-id-2> ...
python scripts/validate_full_pipeline.py <idea-id-1> <idea-id-2> ...
```
Both run the real pipeline against real ideas from your database — proof the agents work end to end, not just against mocks. `validate_full_pipeline.py` (Task 6) runs all 4 stages per idea in order and specifically checks that missing-field handling worked where relevant — include at least one idea with no `tech_stack`/`duration` set to see that in action.

## Project structure
```
app/
  main.py                    -> FastAPI app, CORS, health check
  core/
    config.py, supabase_client.py, gemini_client.py
    idea_repository.py        -> Step 2
    feedback_repository.py    -> Step 6/7 (now stores + returns `details`)
  agents/
    feasibility_agent.py      -> Task 1
    scope_agent.py             -> Task 2
    technology_agent.py        -> Task 3
    timeline_agent.py          -> Task 4
  schemas/                    -> data shapes (one result schema per agent)
  routers/
    debug.py                  -> GET test endpoints
    agents.py                 -> the real endpoints + agent-chaining logic
tests/                        -> 69 tests across every module
scripts/                      -> Step 7 validation script
supabase/                     -> DB migrations
```

## Semantic search over project documents (pgvector)

Adds vector-embedding storage for generated project documents (synopsis, methodology, progress report), so a project's documents become semantically searchable.

**Setup**
1. Run `supabase/migration_step9_pgvector_embeddings.sql` in the Supabase SQL editor. It enables the `vector` extension, creates `document_chunks`, and adds a `match_document_chunks()` RPC for similarity search.
2. `pip install -r requirements.txt` (pulls in `sentence-transformers`, which pulls in `torch` — the first embedding call downloads the `all-MiniLM-L6-v2` model, ~90MB, and caches it locally).

**Endpoints**
```
POST /embeddings/process/{document_type}/{idea_id}
  body (optional): {"text": "..."}   # omit to auto-pull the latest stored DOCX for that idea/type
  -> chunks the text, embeds each chunk, stores vectors in document_chunks

POST /embeddings/search
  body: {"idea_id": "...", "query": "...", "match_count": 5, "document_type": "synopsis"}
  -> cosine-similarity search over that project's chunks
```

**How it works**
- `app/services/embedding_service.py` — word-based chunking (`embedding_chunk_size` / `embedding_chunk_overlap` in `.env`, default 220 words with 40-word overlap), DOCX text extraction, and a cached `sentence-transformers` model loader.
- `app/core/embedding_repository.py` — Supabase reads/writes for `document_chunks`, including the `match_document_chunks` RPC call.
- Embeddings are 384-dim (`all-MiniLM-L6-v2`) and normalized at encode time, so cosine similarity reduces to a dot product.
- Re-processing a document deletes its previous chunks first, so regenerating a synopsis and re-embedding it doesn't leave stale rows behind.

## Semantic caching for Gemini calls

Cuts Gemini API cost/latency by reusing a previous response when an incoming query is a near-duplicate of one already answered (cosine similarity >= 0.90 by default), instead of calling the model again.

**Setup**
1. Run `supabase/migration_step10_semantic_cache.sql` in the Supabase SQL editor (after `migration_step9_pgvector_embeddings.sql`, which enables the `vector` extension). Creates `semantic_cache` plus `match_semantic_cache()` / `record_semantic_cache_hit()` RPCs.
2. No new Python packages — it reuses the `sentence-transformers` embedding model from the pgvector document-embeddings feature.
3. Tune via `.env`: `SEMANTIC_CACHE_ENABLED` (default `true`) and `SEMANTIC_CACHE_SIMILARITY_THRESHOLD` (default `0.90`).

**How it works**
- `app/services/semantic_cache_service.py` — `check_cache()` embeds the query and looks for a cached hit above the threshold; `store_cache()` saves a fresh (query, response, embedding) row after a miss. Call-site agnostic — any Gemini call can use it via a `cache_scope` string.
- `app/core/semantic_cache_repository.py` — the Supabase/RPC calls behind it.
- `app/dependencies/semantic_cache.py` — `mentor_chat_cache`, a real FastAPI `Depends()` dependency wired into `POST /mentor/chat/{idea_id}`. Because FastAPI resolves a dependency's parameters (`idea_id`, the request body) the same way it resolves an endpoint's, the cache check runs *before* the endpoint decides whether to call Gemini at all.
- Cache entries are scoped by `(cache_scope, idea_id)` — a mentor reply is grounded in one project's data, so a cache hit is only ever served within the same idea, never across projects or across different endpoints.
- On a hit: the cached reply is returned, both chat messages are still saved to history, and `MentorChatResponse.cache_hit` is `true` — Gemini is never called.
- On a miss: `chat_with_mentor()` runs as before, and the new response is stored (reusing the embedding already computed by the dependency, so the query is only ever encoded once per request).

To add caching to another Gemini call site (an agent, document generation, etc.), call `check_cache(scope=..., query_text=..., idea_id=...)` before the Gemini call and `store_cache(...)` after — no changes to `semantic_cache_service.py` needed.

## LangGraph: parallel multi-agent project review

Upgrades agent execution from isolated scripts into a stateful LangGraph workflow: Feasibility, Risk, and Technology run **simultaneously** (fan-out), then a Mentor agent **waits for all three** and synthesizes one final review (fan-in).

**Endpoint**
```
POST /graph-review/{idea_id}
-> { idea_id, feasibility, risk, technology, mentor_review, errors: [] }
```

**Setup**: `pip install -r requirements.txt` (adds `langgraph` + its dependencies — no new environment variables needed).

**Files** — `app/langgraph_workflows/`:
- `state.py` — `ProjectReviewState`, a `TypedDict` every node reads from and writes to: `idea_id`, `context`, `feasibility_result`, `risk_result`, `technology_result`, `mentor_review`, `errors`. `errors` is `Annotated[list[str], operator.add]` so that if two of the three parallel nodes both fail in the same superstep, their error messages merge instead of one clobbering the other — the one field genuinely written concurrently needs a reducer; the three `*_result` fields don't, since each has exactly one writer.
- `nodes.py` — five node functions: `load_context_node` fetches the project once and puts it in shared state; `feasibility_node` (reuses the actual sequential Feasibility Agent — it was already independent), `risk_node`, and `technology_node` (graph-local standalone prompts, since the sequential Risk/Technology agents require another agent's output as input and so can't run in parallel with it); `mentor_synthesis_node` reads all three results back out of shared state and asks Gemini to synthesize one coherent review.
- `graph.py` — wires it into a `StateGraph`: `load_context` has three outgoing edges (the fan-out), and `mentor_synthesis` has three incoming edges (the fan-in — LangGraph doesn't schedule a node until every edge feeding it has fired, so no manual "wait for all three" code is needed).

**Verified concurrency**: with three 1-second mock node calls, total graph runtime was ~1.0s, not ~3s — LangGraph genuinely executes same-superstep nodes concurrently, including plain synchronous functions.

**Fault tolerance**: each of the three parallel nodes catches its own exceptions into `errors` rather than raising, so e.g. a single Gemini hiccup on the Risk node doesn't lose the Feasibility and Technology results that already came back — `mentor_synthesis_node` synthesizes from whatever succeeded and notes what didn't.

This is a distinct workflow from the existing sequential Milestone-2 pipeline (`/agents/...`), not a replacement — the sequential pipeline's Scope → Technology → Risk chain depends on each prior stage's output, which is exactly what makes it unable to run in parallel. This graph trades that chaining for speed: a faster, coarser "quick review" that judges Feasibility/Risk/Technology independently and lets the Mentor agent reconcile them at the end.

## Long-term agent memory (mem0ai)

Gives every agent a persistent memory layer -- student preferences, project evolution, and each agent's own past conclusions carry forward across runs instead of every call starting from a blank slate.

**Setup**
1. Get a **direct Postgres connection string** from the Supabase dashboard: Project Settings → Database → Connection string (URI). This is a different credential from `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` -- those talk to Supabase over PostgREST, but mem0's pgvector store needs raw SQL access.
2. Set `SUPABASE_DB_CONNECTION_STRING` in `.env` to that value.
3. `pip install -r requirements.txt` (adds `mem0ai` + `psycopg[binary,pool]`; no new API keys -- it reuses `GEMINI_API_KEY` for extraction and the same local `sentence-transformers` model already used elsewhere for embeddings).
4. Memory is on by default (`MEMORY_ENABLED=true`). If `SUPABASE_DB_CONNECTION_STRING` is left blank, every memory call becomes a no-op (logged, not raised) rather than breaking requests -- safe to leave disabled in an environment that doesn't need it yet.

**Extraction pipeline**
`app/services/memory_service.py:remember_conversation()` hands a short exchange (e.g. a student's message + the mentor's reply, or an agent's verdict) to `mem0.add(messages, ..., infer=True)`. `infer=True` is mem0's own extraction pipeline: internally it uses an LLM (configured here as Gemini) to read the exchange, pull out atomic facts, and decide whether each one is new, an update to something already stored, or a duplicate to discard -- we don't hand-write that logic, we only configure which LLM/embedder/vector store mem0 uses (`app/core/mem0_client.py`).

**Multi-level scopes**, mapped onto mem0's native `user_id` / `run_id` / `agent_id`:
| Scope | mem0 field | Value | What it captures |
|---|---|---|---|
| User-level | `user_id` | `student_id` | Stable preferences and skill notes that persist across every project |
| Session-level | `run_id` | `idea_id` | One project's evolution over time — timeline shifts, recurring blockers |
| Agent-level | `agent_id` | agent name (`feasibility`, `risk`, `technology`, `mentor`) | What a specific specialist has already told this student, so it isn't re-derived from scratch every run |

A single `mem0.add()` call sets all three at once. Retrieval (`recall_memories()`) runs up to three separate scoped searches and merges the results, since mem0's `search(filters={...})` ANDs every key given together -- a single combined filter would miss a user-level-only memory that has no `run_id`/`agent_id` set.

**Wired into the LangGraph nodes** (`app/langgraph_workflows/nodes.py`): before every Gemini call — `feasibility_node`, `risk_node`, `technology_node`, and the `mentor_synthesis_node` fan-in step — the node calls `recall_memories()` and prepends the result (`format_memories_for_prompt()`) onto that call's `system_instruction`. After a successful call, `remember_agent_result()` writes the outcome back into mem0 (`agent_id` set to that node's name), so the next graph run — and the mentor chat endpoint, since they share the same store — can recall it. `ProjectReviewState.memories_used` (a parallel-safe `operator.add` log field, same pattern as `errors`) records how many memories each node recalled, and `POST /graph-review/{idea_id}` returns it for transparency.

**Also wired into `POST /mentor/chat/{idea_id}`**: this is the most literal "conversation messages" source, so it recalls memories before calling Gemini (folded into `chat_with_mentor`'s system prompt via a new `memory_context` parameter) and feeds every turn — cache hit or miss — through `remember_conversation()` afterward.

**Verified**: ran the full graph end-to-end with a fake mem0 client and mocked Gemini calls, confirming (a) `recall_memories()` results actually appear inside the `system_instruction` sent to Gemini for all four nodes, and (b) `mem0.add()` is called exactly once per node with the correct `user_id`/`run_id`/`agent_id` triple.

## Semantic Router: Mixture-of-Models gateway

Balances cost/latency against answer quality by classifying each incoming prompt's complexity and routing it to one of two Gemini tiers, instead of every call using the same model regardless of how simple or hard the question is.

**Setup**: no new dependencies — reuses the local `sentence-transformers` embedder already installed for document embeddings and the semantic cache. Configure the two tiers in `.env` (`GEMINI_MODEL_FAST` defaults to your existing `gemini_model`, i.e. today's status quo; `GEMINI_MODEL_DEEP` is the new heavier tier — adjust both to whatever's available in your Google AI Studio account). `SEMANTIC_ROUTER_ENABLED=false` reverts every routed call to `GEMINI_MODEL` unconditionally.

**How classification works** (`app/routing/`):
- `routes.py` — two short lists of representative example prompts, one for the "fast" tier (short factual asks, lookups, simple rephrasing) and one for "deep" (multi-step reasoning, trade-off analysis, synthesis, architecture design). Tuning these lists — not the threshold — is the main lever for improving routing accuracy over time.
- `semantic_router.py` — `classify_complexity(prompt)` embeds the prompt with the existing local model, finds its nearest exemplar across both lists by cosine similarity (the same "nearest-exemplar" approach the open-source `semantic-router` library popularized), and applies a small heuristic bias on top (prompt length, reasoning-trigger words like "analyze"/"trade-off"/"synthesize", multiple questions) to correct for a known weak spot of small sentence embedders — a short, dense request can otherwise sit close to a long simple one purely on topic overlap. If neither route clears `SEMANTIC_ROUTER_CONFIDENCE_THRESHOLD`, the prompt falls back to `SEMANTIC_ROUTER_DEFAULT_TIER` rather than trusting a low-confidence match.
- `gateway.py` — `route_and_generate()` is the actual interception point: classify, dispatch the Gemini call to the winning tier's model, return `(response, RouteDecision)`. Supports `force_tier` for call sites that already know a task is always complex, and degrades to the single-tier default automatically if the router is disabled or fails internally.

**Wired into `POST /mentor/chat/{idea_id}`** — the reference integration, since open-ended student chat is the one place message complexity genuinely varies turn to turn ("what's MQTT?" vs "help me rethink my architecture given the risk you flagged"). `chat_with_mentor()` now classifies `user_message` specifically (not the full assembled system prompt, which is roughly constant-shaped per call and would swamp the actual signal) and returns which tier answered; the response's new `model_tier` field surfaces it (`"fast"`, `"deep"`, or `"cached"` when the semantic cache served the reply without calling Gemini at all).

**Not** retrofitted onto the Feasibility/Risk/Technology/LangGraph agents — those produce a fixed, structured JSON shape every call, so their complexity doesn't vary call-to-call the way open-ended chat does; per-call classification there would add embedding overhead without ever changing which model gets picked.

**Standalone endpoint for tuning/observability**: `POST /router/classify {"prompt": "..."}` returns the full decision — tier, model, similarity score, matched exemplar, and whether it fell back to the default — without calling Gemini, so you can test/tune the router directly against real prompts.

**Verified**: classification logic tested against synthetic embeddings (clear-cut fast/deep routing, confidence-threshold fallback, heuristic bias magnitude) and the gateway's dispatch tested with a mocked Gemini client (correct model chosen per tier, `force_tier` bypasses classification entirely, `SEMANTIC_ROUTER_ENABLED=false` falls back to the single default model) before packaging.

## DSPy: structured signatures replace hand-written prompts

Every agent in `app/agents/` (plus the three graph-local prompts in `app/langgraph_workflows/nodes.py`) has been rewritten from a hand-written English `SYSTEM_PROMPT` string + manual JSON parsing onto [DSPy](https://dspy.ai): each agent now declares a `dspy.Signature` with explicit, typed `dspy.InputField()`/`dspy.OutputField()` declarations, and runs it through a `dspy.Module` (`dspy.ChainOfThought` for the analytical agents, `dspy.Predict` for mentor chat). DSPy's adapter turns the signature into the actual prompt sent to Gemini and parses the structured response back into typed Python values — prompt construction and JSON parsing are no longer hand-rolled per agent.

**Setup**: no new API keys — DSPy talks to Gemini through [LiteLLM](https://docs.litellm.ai) using the same `GEMINI_API_KEY` already configured. `pip install -r requirements.txt` adds `dspy` and its dependency tree (`litellm`, `gepa`, `diskcache`, etc.).

**Core infra** — `app/core/dspy_config.py`: builds and caches three `dspy.LM` instances (`get_default_lm`, `get_fast_lm`, `get_deep_lm`, mapped to `GEMINI_MODEL` / `GEMINI_MODEL_FAST` / `GEMINI_MODEL_DEEP`) and `ensure_dspy_configured()`, called once at the top of every agent entry-point to set the process-wide default LM.

**Every agent rewritten**, each with its `dspy.Signature` colocated in the same file as before: `feasibility_agent`, `scope_agent`, `technology_agent`, `timeline_agent`, `risk_agent`, `novelty_agent`, `calibration_agent`, `skill_development_agent`, `team_momentum_agent`, `faculty_digest_agent`, `viva_agent`, `viva_studio_agent` (three signatures — question generation, answer evaluation, final feedback), and `mentor_agent` (chat + weekly check-in). Every function keeps its original name, parameters, and return type, so no router, service, or schema anywhere else in the codebase needed to change — only each agent's internal prompt-building/parsing was replaced.

**Worth knowing, two intentional changes that came out of doing this rewrite properly rather than mechanically:**
- `risk_agent.py` previously asked the LLM to copy `combined_skill_gaps`/`combined_missing_inputs` through into its output verbatim — a purely mechanical step with no need for a language model. The rewrite computes those two fields directly in Python from the already-assembled payload and only asks the signature for the parts that need judgment (verdict, the risks themselves, reasoning). One less avoidable source of drift.
- Nested output shapes (e.g. `risk_agent`'s `risks: list[RiskItem]`, `viva_agent`'s `panel: list[PanelQuestion]`) are typed directly as the existing Pydantic models from `app/schemas/` — DSPy validates and coerces into them natively, so the same schema classes serve both the API response shape and the LLM's structured output contract.

**Semantic router integration preserved**: `app/routing/gateway.py` no longer calls Gemini directly — `select_lm_for_prompt()` now resolves a routing decision to a `dspy.LM` instance, and `mentor_agent.chat_with_mentor()` runs its `ChatSignature` inside `with dspy.context(lm=lm):` to use whichever tier the router picked. The Mixture-of-Models behavior from that feature is unchanged; only the underlying call mechanism moved onto DSPy.

**Verified before packaging**: every one of the 13 agent files' entry-point functions was actually run (not just imported) against `dspy.utils.DummyLM` with realistic canned responses, asserting the returned Pydantic objects have the right verdict/fields — including the nested-list cases (`RiskItem`, `PanelQuestion`, `LearningPathItem`) and the mentor chat's semantic-router integration (mocked tier selection feeding into `dspy.context`). The full FastAPI app was also loaded end-to-end (`app.main.app`, all 33 routes) to confirm no import-time breakage across the rewrite.

## LLM-as-a-Judge online evaluation pipeline

Every primary agent's output is now scored by a secondary Judge model against a written rubric — hallucination, relevance, logical soundness — before that output is treated as finalized. This is an *online* pipeline: it runs inline, synchronously, as part of the same request that produces the agent's answer, not an offline batch job run later.

**Setup**: no new API keys — the Judge runs on Gemini through the same DSPy/LiteLLM path as every other agent. `JUDGE_MODEL` (default `gemini-3.1-pro`) is deliberately its own setting, separate from `GEMINI_MODEL`/`GEMINI_MODEL_FAST`/`GEMINI_MODEL_DEEP` — a model grading its own output is a well-known source of inflated self-assessment, so the Judge always runs as an independent call on its own configured model, regardless of which tier answered. `EVALUATION_ENABLED=false` turns the whole pipeline off (every agent endpoint keeps working exactly as before, just without a Judge call).

**The written rubric** — `app/evaluation/judge.py`'s `JudgeSignature` docstring — scores three dimensions 0-100 with concrete scoring bands for each (not vague "rate this 1-10"):
- **Hallucination score**: does every claim trace to the input, or is something fabricated/unsupported? (e.g. flagging a skill gap in a technology the input never mentions)
- **Relevance score**: does the output specifically engage with *this* project's data, or could it have been produced without reading the input?
- **Logical soundness score**: are the verdict, confidence, and reasoning internally consistent, or does the reasoning describe a serious problem while the verdict says everything's fine?

An `overall_score` (holistic, weighted toward hallucination — a confidently fabricated verdict is the most harmful failure mode here) maps mechanically to a `verdict`: **Pass** (≥75), **Needs Review** (40–74), **Fail** (<40), plus a list of specific `flagged_issues`.

**Where the interception happens** — `app/evaluation/judge_service.py`'s `evaluate_agent_output()` is called from `app/routers/agents.py`, right after each of the 11 primary agents (Feasibility, Scope, Technology, Timeline, Risk, Novelty, Skill Development, Team Momentum, Calibration, Mentor Digest, Viva Panel) produces its result and is saved via `save_agent_feedback()` — the evaluation row is linked to that saved feedback via `feedback_id`, and completes before the HTTP response is returned to the caller.

**Deliberately not wired in**: mentor chat (open-ended conversation has no fixed rubric per turn, and judging every casual message would roughly double chat latency/cost for a UX that's meant to feel snappy) and Viva Studio's live Q&A loop (a real-time interactive exchange, where added latency directly hurts the "in the moment" prep experience). Both follow the exact same `evaluate_agent_output()` pattern if you want to add them later — see any of the 11 wired call sites in `agents.py` as a template.

**Never blocks or fails the actual response**: same resilience philosophy as the rest of this backend (semantic cache, mem0, etc.) — a Judge timeout, a bad Judge response, or a failed evaluation-row write all degrade to "no evaluation recorded for this run" (logged, not raised), never a 500 for the student. A `Fail` verdict is recorded and logged as a warning; it does not reject or alter the agent's actual output.

**Observability** — `app/routers/evaluation.py`:
```
GET /evaluations/{idea_id}   -> every recorded evaluation for one project, most recent first
GET /evaluations/flagged     -> every verdict != Pass across the whole platform, worst score first
```
`/evaluations/flagged` is what an ops/faculty dashboard would poll to see which agent runs need a human look — backed by a partial index (`WHERE verdict != 'Pass'`) so that query stays fast as the table grows.

**Setup**: run `supabase/migration_step11_agent_evaluations.sql` in the Supabase SQL editor. Creates `agent_evaluations`, FK'd to both `project_ideas` and `agent_feedback`.

**Verified before packaging**: the Judge signature tested directly against both a clean "Pass" case and a deliberately fabricated "Fail" case (confirming it actually catches a hallucinated skill gap and flags it by name); the service wrapper tested for its normal path, a Judge failure, a storage failure, and the disabled flag — all four resilience paths behave correctly; and a full integration test against the actual `run_feasibility_agent` endpoint confirming the real call order (analyze → save → evaluate, with the evaluation correctly linked to the saved `feedback_id`).
