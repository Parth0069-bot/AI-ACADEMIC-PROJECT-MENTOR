"""
The classifier half of the semantic router: given a prompt, decide
whether it belongs on the "fast" or "deep" model tier.

Primary signal: embedding similarity. The prompt is embedded with the
same local sentence-transformers model already used elsewhere in this
backend (document embeddings, semantic cache -- see
app/services/embedding_service.py), then compared against the FAST
and DEEP exemplar utterances in routes.py. Whichever exemplar is
nearest (highest cosine similarity) decides the route -- this is
"semantic" routing rather than keyword matching: "what's this project
costing me in time" and "help me understand my project's timeline
risk" route the same way despite sharing almost no words, because
they mean similar things.

Secondary signal: a small heuristic bias (prompt length, reasoning
trigger words, multiple questions) nudges the deep-route score up or
down. This exists to correct for a known weakness of small sentence
embedders: a short, information-dense request ("optimize this for
O(log n)") can sit close to a long, simple one in embedding space
purely on topic overlap, when length and register are actually a
useful independent signal for how much reasoning a prompt needs.

If neither route clears `semantic_router_confidence_threshold`, the
prompt falls back to `semantic_router_default_tier` rather than
trusting a low-confidence match -- this is what keeps borderline
prompts from randomly flip-flopping between tiers.
"""

import logging
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from app.core.config import settings
from app.routing.routes import DEEP_TIER_EXEMPLARS, FAST_TIER_EXEMPLARS
from app.services.embedding_service import embed_query, get_embedding_model

logger = logging.getLogger(__name__)

Tier = str  # "fast" | "deep"

_REASONING_TRIGGERS = [
    "analyze", "analyse", "compare", "trade-off", "tradeoff", "architecture",
    "design a", "design an", "why does", "why is", "why would", "synthesize",
    "synthesise", "reconcile", "optimize", "optimise", "root cause",
    "debug why", "second-order", "strategy", "evaluate", "critically",
    "de-risk", "derisk", "justify", "walk me through",
]


@dataclass
class RouteDecision:
    tier: Tier
    model: str
    confidence: float
    matched_route: Tier
    matched_exemplar: str
    used_default: bool
    heuristic_bias: float
    reasoning: str


def _model_for_tier(tier: Tier) -> str:
    return settings.gemini_model_deep if tier == "deep" else settings.gemini_model_fast


def _heuristic_bias(prompt: str) -> float:
    """
    Returns a small delta (roughly -0.05 to +0.15) applied to the
    deep-route's similarity score before comparing it to the
    fast-route's. Positive nudges toward "deep", negative toward
    "fast". Intentionally a minor secondary signal -- embedding
    similarity does the primary work.
    """

    word_count = len(prompt.split())
    bias = 0.0

    if word_count >= 40:
        bias += 0.06
    elif word_count <= 8:
        bias -= 0.05

    lowered = prompt.lower()
    trigger_hits = sum(1 for kw in _REASONING_TRIGGERS if kw in lowered)
    bias += min(trigger_hits * 0.04, 0.12)

    if prompt.count("?") >= 2:
        bias += 0.03

    return bias


@lru_cache
def _get_route_embeddings() -> tuple[np.ndarray, np.ndarray]:
    """
    Encodes both exemplar lists once per process and caches the
    result -- this is the only place exemplar embedding happens;
    every classify_complexity() call after the first just reuses it.
    """

    model = get_embedding_model()

    fast_matrix = np.array(
        model.encode(FAST_TIER_EXEMPLARS, normalize_embeddings=True, show_progress_bar=False)
    )
    deep_matrix = np.array(
        model.encode(DEEP_TIER_EXEMPLARS, normalize_embeddings=True, show_progress_bar=False)
    )

    logger.info(
        "Semantic router: encoded %d fast-tier and %d deep-tier route exemplars",
        len(FAST_TIER_EXEMPLARS),
        len(DEEP_TIER_EXEMPLARS),
    )

    return fast_matrix, deep_matrix


def classify_complexity(prompt: str) -> RouteDecision:
    """
    Classifies one prompt and returns which model tier it should run
    on. Never raises -- on any internal failure (e.g. the embedding
    model can't load), falls back to `semantic_router_default_tier`
    so a routing problem degrades to "always use one tier" rather
    than breaking the request entirely.
    """

    default_tier = settings.semantic_router_default_tier

    if not prompt or not prompt.strip():
        return RouteDecision(
            tier=default_tier,
            model=_model_for_tier(default_tier),
            confidence=0.0,
            matched_route="none",
            matched_exemplar="",
            used_default=True,
            heuristic_bias=0.0,
            reasoning="Empty prompt -- defaulted without classifying.",
        )

    try:
        query_embedding = np.array(embed_query(prompt))
        fast_matrix, deep_matrix = _get_route_embeddings()

        fast_similarities = fast_matrix @ query_embedding
        deep_similarities = deep_matrix @ query_embedding

        fast_best_idx = int(np.argmax(fast_similarities))
        deep_best_idx = int(np.argmax(deep_similarities))
        fast_best_score = float(fast_similarities[fast_best_idx])
        deep_best_score = float(deep_similarities[deep_best_idx])

    except Exception:
        logger.exception("Semantic router classification failed -- defaulting to %s tier", default_tier)
        return RouteDecision(
            tier=default_tier,
            model=_model_for_tier(default_tier),
            confidence=0.0,
            matched_route="none",
            matched_exemplar="",
            used_default=True,
            heuristic_bias=0.0,
            reasoning="Classification failed (see logs) -- defaulted without a similarity score.",
        )

    bias = _heuristic_bias(prompt)
    deep_score_adjusted = deep_best_score + bias

    if deep_score_adjusted >= fast_best_score:
        top_tier: Tier = "deep"
        top_raw_score = deep_best_score
        top_exemplar = DEEP_TIER_EXEMPLARS[deep_best_idx]
    else:
        top_tier = "fast"
        top_raw_score = fast_best_score
        top_exemplar = FAST_TIER_EXEMPLARS[fast_best_idx]

    if top_raw_score < settings.semantic_router_confidence_threshold:
        chosen_tier = default_tier
        used_default = True
        reasoning = (
            f"Nearest exemplar was in the '{top_tier}' route (\"{top_exemplar}\") at "
            f"similarity {top_raw_score:.3f}, below the confidence threshold "
            f"({settings.semantic_router_confidence_threshold}) -- defaulted to '{chosen_tier}' tier."
        )
    else:
        chosen_tier = top_tier
        used_default = False
        bias_note = f", heuristic bias {bias:+.3f}" if abs(bias) > 1e-6 else ""
        reasoning = (
            f"Routed to '{chosen_tier}' tier: nearest exemplar (\"{top_exemplar}\") at "
            f"similarity {top_raw_score:.3f}{bias_note}."
        )

    return RouteDecision(
        tier=chosen_tier,
        model=_model_for_tier(chosen_tier),
        confidence=round(top_raw_score, 4),
        matched_route=top_tier,
        matched_exemplar=top_exemplar,
        used_default=used_default,
        heuristic_bias=round(bias, 4),
        reasoning=reasoning,
    )
