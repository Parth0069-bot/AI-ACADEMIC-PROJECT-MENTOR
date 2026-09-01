"""
The gateway half of the semantic router / Mixture-of-Models setup.

`select_lm_for_prompt()` is the single choke point call sites use to
turn a routing decision into an actual DSPy language model. It:

  1. Classifies `prompt_for_classification` (see semantic_router.py)
     to decide "fast" or "deep" tier.
  2. Resolves that tier to the matching dspy.LM instance (see
     app/core/dspy_config.py).
  3. Returns both the LM and the routing decision, so the caller can
     run its dspy.Signature module with `dspy.context(lm=lm)` and
     log/expose which tier handled the request.

Why classification runs on a *separate* string from the rest of a
call's inputs: an agent call's full assembled context (project data,
skill lists, formatting instructions) is roughly constant-shaped per
call and would swamp the actual signal of how complex the underlying
ask is. Callers should pass the part that actually varies in
complexity (typically the student's own message) as
`prompt_for_classification`.

This is intentionally opt-in per call site (see app/agents/mentor_agent.py
for the reference integration) rather than a blanket interceptor over
every DSPy call in the codebase -- agents with a fixed, structured
JSON-output shape per call (Feasibility, Risk, Technology, ...) don't
vary in complexity call-to-call the way open-ended chat does, so
per-call classification would mostly just add embedding overhead
without changing which model gets used.
"""

import logging

import dspy

from app.core.config import settings
from app.core.dspy_config import get_default_lm, get_deep_lm, get_fast_lm
from app.routing.semantic_router import RouteDecision, classify_complexity

logger = logging.getLogger(__name__)


def select_lm_for_prompt(
    *,
    prompt_for_classification: str,
    force_tier: str | None = None,
) -> tuple[dspy.LM, RouteDecision]:
    """
    Classifies `prompt_for_classification`, then resolves whichever
    tier the router picked (or `force_tier`, if a caller already
    knows -- e.g. a task type that's always complex) to a dspy.LM.

    Returns (lm, RouteDecision). Use like:

        lm, decision = select_lm_for_prompt(prompt_for_classification=user_message)
        with dspy.context(lm=lm):
            prediction = my_module(**inputs)
    """

    if force_tier in ("fast", "deep"):
        lm = get_deep_lm() if force_tier == "deep" else get_fast_lm()
        model_name = settings.gemini_model_deep if force_tier == "deep" else settings.gemini_model_fast
        decision = RouteDecision(
            tier=force_tier,
            model=model_name,
            confidence=1.0,
            matched_route=force_tier,
            matched_exemplar="",
            used_default=False,
            heuristic_bias=0.0,
            reasoning=f"Tier forced to '{force_tier}' by caller -- router not consulted.",
        )
    elif not settings.semantic_router_enabled:
        lm = get_default_lm()
        decision = RouteDecision(
            tier="fast",
            model=settings.gemini_model,
            confidence=1.0,
            matched_route="none",
            matched_exemplar="",
            used_default=True,
            heuristic_bias=0.0,
            reasoning="Semantic router disabled (SEMANTIC_ROUTER_ENABLED=false) -- using the default model.",
        )
    else:
        decision = classify_complexity(prompt_for_classification)
        lm = get_deep_lm() if decision.tier == "deep" else get_fast_lm()

    logger.info(
        "Semantic router: tier=%s model=%s confidence=%.3f default=%s -- %s",
        decision.tier,
        decision.model,
        decision.confidence,
        decision.used_default,
        decision.reasoning,
    )

    return lm, decision
