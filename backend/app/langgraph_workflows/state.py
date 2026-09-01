"""
Shared state for the LangGraph "quick project review" workflow.

Every node in the graph (load_context, feasibility, risk, technology,
mentor_synthesis) reads from and writes to this single TypedDict.
LangGraph merges each node's returned partial dict into this shared
state between supersteps (its "Pregel"-style execution model), so a
node only needs to return the keys it actually changed.

Why `errors` is `Annotated[list[str], operator.add]`:
the feasibility, risk, and technology nodes run in the SAME
superstep (true parallel fan-out -- see graph.py). If more than one
of them fails and appends to `errors` in that same step, LangGraph
needs a reducer to know how to combine those concurrent writes to
the same key, rather than one silently clobbering the other.
`operator.add` on two lists concatenates them, so every node's
errors are preserved. `feasibility_result` / `risk_result` /
`technology_result` don't need a reducer because each is written by
exactly one node -- no concurrent writer to reconcile. `memories_used` is a
log-style list (one short string per node describing what it recalled from
mem0) and uses the same `operator.add` reducer for the same reason `errors`
does.
"""

import operator
from typing import Annotated, Any, TypedDict


class ProjectReviewState(TypedDict, total=False):
    # ---- input ----
    idea_id: str

    # ---- populated by load_context (runs first) ----
    context: dict[str, Any] | None

    # ---- fan-out: written by the three parallel agent nodes ----
    feasibility_result: dict[str, Any] | None
    risk_result: dict[str, Any] | None
    technology_result: dict[str, Any] | None

    # ---- fan-in: written by mentor_synthesis, after all three above ----
    mentor_review: dict[str, Any] | None

    # ---- accumulated across every node, parallel-safe via operator.add ----
    errors: Annotated[list[str], operator.add]
    memories_used: Annotated[list[str], operator.add]
