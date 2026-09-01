"""
Builds the "quick project review" LangGraph:

                    ┌──────────────┐
                    │ load_context │
                    └──────┬───────┘
             ┌─────────────┼─────────────┐
             ▼              ▼              ▼            <- fan-out (parallel)
     ┌───────────────┐┌───────────┐┌──────────────┐
     │  feasibility   ││   risk    ││  technology  │
     └───────┬────────┘└─────┬─────┘└──────┬───────┘
             └──────────────┼──────────────┘
                             ▼                            <- fan-in
                  ┌───────────────────┐
                  │  mentor_synthesis  │
                  └─────────┬──────────┘
                             ▼
                            END

Fan-out: `load_context` has three outgoing edges. LangGraph schedules
every node with no unmet dependency in the same superstep, so
feasibility/risk/technology genuinely run concurrently (verified with
sync node functions -- LangGraph runs same-superstep nodes through an
executor, not one after another).

Fan-in: `mentor_synthesis` has three incoming edges (from feasibility,
risk, technology). LangGraph does not run a node until every edge
feeding it has fired in the current or an earlier superstep, so
mentor_synthesis is only ever scheduled once all three parallel
branches have finished -- no manual "wait for all three" logic is
needed; it falls directly out of the graph's edges.
"""

from functools import lru_cache

from langgraph.graph import END, StateGraph

from app.langgraph_workflows.nodes import (
    feasibility_node,
    load_context_node,
    mentor_synthesis_node,
    risk_node,
    technology_node,
)
from app.langgraph_workflows.state import ProjectReviewState


def build_project_review_graph():
    graph = StateGraph(ProjectReviewState)

    graph.add_node("load_context", load_context_node)
    graph.add_node("feasibility", feasibility_node)
    graph.add_node("risk", risk_node)
    graph.add_node("technology", technology_node)
    graph.add_node("mentor_synthesis", mentor_synthesis_node)

    graph.set_entry_point("load_context")

    # Fan-out: three edges from the same node = parallel branches.
    graph.add_edge("load_context", "feasibility")
    graph.add_edge("load_context", "risk")
    graph.add_edge("load_context", "technology")

    # Fan-in: mentor_synthesis waits for all three incoming edges.
    graph.add_edge("feasibility", "mentor_synthesis")
    graph.add_edge("risk", "mentor_synthesis")
    graph.add_edge("technology", "mentor_synthesis")

    graph.add_edge("mentor_synthesis", END)

    return graph.compile()


@lru_cache
def get_compiled_graph():
    """Compiling the graph is cheap but only needs to happen once per process."""
    return build_project_review_graph()


def run_project_review(idea_id: str) -> ProjectReviewState:
    """
    Runs the full parallel review workflow for one project idea and
    returns the final shared state (context + all three parallel
    results + the mentor's synthesized review + any errors).
    """

    compiled_graph = get_compiled_graph()

    initial_state: ProjectReviewState = {
        "idea_id": idea_id,
        "context": None,
        "feasibility_result": None,
        "risk_result": None,
        "technology_result": None,
        "mentor_review": None,
        "errors": [],
        "memories_used": [],
    }

    return compiled_graph.invoke(initial_state)
