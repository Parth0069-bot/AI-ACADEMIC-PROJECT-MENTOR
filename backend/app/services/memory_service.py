"""
High-level memory operations used by both the LangGraph nodes and the
mentor chat endpoint.

Multi-level scopes map onto mem0's native `user_id` / `run_id` /
`agent_id` dimensions like this:

  - User-level   -> user_id  = student_id
    Persists across every project and session for that student --
    stable preferences ("prefers concise feedback"), durable skill
    notes ("consistently strong in Python, weak in embedded C").

  - Session-level -> run_id  = idea_id
    Scoped to one project's ongoing "session" -- this is how project
    *evolution over time* gets remembered (a timeline that shifted,
    a pivot in scope, a recurring blocker across several check-ins).

  - Agent-level   -> agent_id = agent name (e.g. "feasibility", "risk",
    "technology", "mentor")
    What a specific specialist agent has previously concluded about
    this student/project, so e.g. the Risk agent doesn't re-flag the
    exact same skill gap it already flagged last week as if it were
    a fresh observation.

A single mem0 memory can (and usually does) carry all three
simultaneously -- see `remember_conversation()`. Retrieval
(`recall_memories()`) runs separate scoped searches and merges them,
since mem0's `search(filters={...})` ANDs every key given, and a
"the student prefers concise feedback" memory (user-level only, no
run_id/agent_id) would never surface from a search that filters by
all three at once.
"""

import logging
from dataclasses import dataclass

from app.core.config import settings
from app.core.mem0_client import MemoryNotConfiguredError, get_memory_client

logger = logging.getLogger(__name__)


@dataclass
class MemoryHit:
    id: str
    text: str
    scope: str  # "user" | "session" | "agent"
    score: float | None = None


def _memory_enabled() -> bool:
    return settings.memory_enabled and bool(settings.supabase_db_connection_string)


def recall_memories(
    *,
    query: str,
    user_id: str,
    run_id: str | None = None,
    agent_id: str | None = None,
    limit: int | None = None,
) -> list[MemoryHit]:
    """
    Runs up to three scoped searches (user-level, session-level,
    agent-level) and merges/dedupes the results, ranked by score.

    Never raises -- a memory-layer outage should degrade an agent's
    context, not break the request. Returns [] on any failure or
    when memory isn't configured.
    """

    if not _memory_enabled():
        return []

    limit = limit or settings.memory_retrieval_limit

    try:
        memory = get_memory_client()
    except MemoryNotConfiguredError:
        return []
    except Exception:
        logger.exception("Failed to initialize mem0 client for recall")
        return []

    scoped_searches: list[tuple[str, dict]] = [("user", {"user_id": user_id})]

    if run_id:
        scoped_searches.append(("session", {"run_id": run_id}))

    if agent_id:
        scoped_searches.append(
            ("agent", {"agent_id": agent_id, "user_id": user_id})
        )

    hits_by_id: dict[str, MemoryHit] = {}

    for scope_label, filters in scoped_searches:
        try:
            result = memory.search(query=query, filters=filters, top_k=limit)
        except Exception:
            logger.exception(
                "mem0 search failed (scope=%s, filters=%s) -- skipping this scope",
                scope_label,
                filters,
            )
            continue

        for row in result.get("results", []):
            memory_id = row.get("id")
            text = row.get("memory")
            score = row.get("score")

            if not memory_id or not text:
                continue

            # A memory can legitimately match more than one scoped
            # search (e.g. a session-level memory that also has an
            # agent_id set); keep the first/most-specific label we
            # saw it under rather than duplicating it in the prompt.
            if memory_id not in hits_by_id:
                hits_by_id[memory_id] = MemoryHit(
                    id=memory_id, text=text, scope=scope_label, score=score
                )

    hits = sorted(hits_by_id.values(), key=lambda h: h.score or 0, reverse=True)
    return hits[:limit]


_SCOPE_LABELS = {
    "user": "Student",
    "session": "This project",
    "agent": "Agent notes",
}


def format_memories_for_prompt(hits: list[MemoryHit]) -> str:
    """
    Renders recalled memories as a compact block to prepend/inject
    into a system prompt. Returns "" when there's nothing to show,
    so callers can safely concatenate this into a template unconditionally.
    """

    if not hits:
        return ""

    lines = [
        f"- [{_SCOPE_LABELS.get(hit.scope, hit.scope)}] {hit.text}" for hit in hits
    ]

    return "=== RELEVANT MEMORY (from past interactions) ===\n" + "\n".join(lines)


def remember_conversation(
    *,
    messages: list[dict],
    user_id: str,
    run_id: str | None = None,
    agent_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    """
    Feeds `messages` (a short exchange -- typically [user turn,
    assistant turn]) through mem0's extraction pipeline, which uses
    an LLM to pull out atomic facts and decide whether to add them as
    new memories, update an existing memory, or discard them as
    duplicates (infer=True, mem0's default). Scoped simultaneously by
    whichever of user_id/run_id/agent_id are provided.

    Best-effort: failures are logged, never raised, since a failed
    memory write shouldn't turn an otherwise-successful agent
    response into an error for the student.
    """

    if not _memory_enabled():
        return

    try:
        memory = get_memory_client()
        memory.add(
            messages,
            user_id=user_id,
            run_id=run_id,
            agent_id=agent_id,
            metadata=metadata,
            infer=True,
        )
    except MemoryNotConfiguredError:
        pass
    except Exception:
        logger.exception(
            "Failed to store conversation memory (user_id=%s, run_id=%s, agent_id=%s)",
            user_id,
            run_id,
            agent_id,
        )


def remember_agent_result(
    *,
    agent_id: str,
    user_id: str,
    run_id: str,
    project_summary: str,
    result_json: dict,
) -> None:
    """
    Convenience wrapper for the LangGraph nodes: turns one agent's
    (project context -> verdict) exchange into a conversation pair
    and hands it to remember_conversation(). Keeps the node functions
    from having to construct message dicts themselves.
    """

    import json

    messages = [
        {
            "role": "user",
            "content": f"[{agent_id} review of project] {project_summary}",
        },
        {
            "role": "assistant",
            "content": json.dumps(result_json, default=str),
        },
    ]

    remember_conversation(
        messages=messages,
        user_id=user_id,
        run_id=run_id,
        agent_id=agent_id,
        metadata={"source": "langgraph_review", "agent": agent_id},
    )
