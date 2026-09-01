"""
DSPy configuration for this backend.

Every agent in app/agents/ now defines its task as a dspy.Signature
(explicit typed InputFields/OutputFields) instead of a hand-written
English prompt string, and runs it through a dspy.Module (mostly
dspy.ChainOfThought, which also gets us a reasoning trace for free).
This module is where DSPy is told which actual model answers those
signatures.

DSPy talks to model providers through LiteLLM: a dspy.LM is
constructed as `dspy.LM("gemini/<model-name>", api_key=...)`. We
don't add a new SDK for this -- it's the same Gemini account and API
key (`GEMINI_API_KEY`) already used everywhere else in the backend.

Two LMs are configured (`get_fast_lm` / `get_deep_lm`), reusing the
exact model names from the semantic router / Mixture-of-Models setup
(`GEMINI_MODEL_FAST` / `GEMINI_MODEL_DEEP`) so that feature keeps
working unchanged -- call sites that route by request complexity
(mentor chat, the LangGraph nodes) select which LM to use via
`dspy.context(lm=...)` around a module call. Every other agent (the
fixed-shape structured-output ones) uses `get_default_lm()`, matching
today's single-model behavior via `GEMINI_MODEL`.
"""

from functools import lru_cache

import dspy

from app.core.config import settings


def dspy_is_configured() -> bool:
    return bool(settings.gemini_api_key)


def _require_configured() -> None:
    if not dspy_is_configured():
        raise RuntimeError(
            "Gemini is not configured. Set GEMINI_API_KEY in your .env file. "
            "Get a free key at https://aistudio.google.com/apikey -- no credit "
            "card required for the free tier."
        )


@lru_cache
def get_default_lm() -> dspy.LM:
    _require_configured()
    return dspy.LM(f"gemini/{settings.gemini_model}", api_key=settings.gemini_api_key)


@lru_cache
def get_fast_lm() -> dspy.LM:
    _require_configured()
    return dspy.LM(f"gemini/{settings.gemini_model_fast}", api_key=settings.gemini_api_key)


@lru_cache
def get_deep_lm() -> dspy.LM:
    _require_configured()
    return dspy.LM(f"gemini/{settings.gemini_model_deep}", api_key=settings.gemini_api_key)


@lru_cache
def get_judge_lm() -> dspy.LM:
    """
    The LLM-as-a-Judge evaluation pipeline (app/evaluation/) deliberately
    uses its own model setting (JUDGE_MODEL, default gemini-3.1-pro)
    rather than reusing get_default_lm()/get_deep_lm() -- a judge
    grading its own model's output is a well-known source of inflated
    self-assessment, so keeping this independently configurable means
    an operator can point it at a different/stronger model even if
    every agent tier shares one model.
    """
    _require_configured()
    return dspy.LM(f"gemini/{settings.judge_model}", api_key=settings.gemini_api_key)


@lru_cache
def _configure_default_once() -> bool:
    """
    dspy.settings needs a default `lm` configured globally before any
    module call that doesn't wrap itself in `dspy.context(lm=...)`.
    Cached so this only actually runs once per process; every agent
    module calls this at the top of its entry-point function (cheap
    no-op after the first call) rather than relying on import order.
    """
    dspy.configure(lm=get_default_lm())

    # DSPy's on-disk LM-call cache is backed by `diskcache`, which has
    # an unpatched pickle-deserialization CVE (PYSEC-2026-2447, no fix
    # release exists yet upstream): anyone with write access to the
    # cache directory can get arbitrary code execution the next time a
    # cached entry is read. Disabling the disk cache removes that
    # attack surface entirely -- this app already has its own semantic
    # cache (see migration_step10_semantic_cache.sql) for repeat-query
    # savings, so DSPy's disk cache isn't needed. The in-memory cache
    # is unaffected and stays on for the lifetime of one process.
    dspy.configure_cache(enable_disk_cache=False, enable_memory_cache=True)
    return True


def ensure_dspy_configured() -> None:
    """Call at the top of every agent entry-point before running a module."""
    _configure_default_once()
