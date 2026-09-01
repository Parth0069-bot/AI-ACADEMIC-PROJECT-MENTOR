"""
Risk Assessment Agent. Rewritten on DSPy.

Note on aggregated_skill_gaps / missing_inputs: the previous prompt
asked the model to copy `combined_skill_gaps`/`combined_missing_inputs`
through into its output verbatim -- a purely mechanical step that
doesn't need a language model at all and (like any LLM-generated
"copy" step) was a small, avoidable source of drift. This rewrite
computes those two fields directly in Python from the already-
assembled payload and only asks the model for the parts that actually
require judgment: the verdict, the risks themselves, and the
reasoning/adjustments.
"""

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult
from app.schemas.risk import RiskResult, RiskVerdict, RiskItem
from app.agents.risk_assemble import assemble_risk_input


class RiskSignature(dspy.Signature):
    """You are the Risk Assessment Agent inside an AI academic project mentor platform. Review
    the results from the Feasibility, Scope, Technology, and Timeline agents together, not in
    isolation, and identify compounding risks. For example, a 'Tight Timeline' verdict combined
    with a skill gap in that same technology should result in one high-severity risk rather
    than two separate low ones.

    Ground every risk description in specifics from the provided data. Do not use generic
    filler. Cite which upstream agent (source_agent) flagged or contributed to each risk
    (Feasibility, Scope, Technology, or Timeline).

    Classify every risk into exactly one of these 5 categories: Technical, Timeline, Skill Gap,
    Scope, Resource.

    Emit only 4-6 prioritized risks, prioritizing the most critical threats to the project. Do
    not provide an exhaustive dump of every minor detail.
    """

    feasibility_summary: str = dspy.InputField()
    scope_summary: str = dspy.InputField()
    technology_summary: str = dspy.InputField()
    timeline_summary: str = dspy.InputField()

    verdict: RiskVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences explaining the overall verdict")
    risks: list[RiskItem] = dspy.OutputField(desc="4-6 prioritized risks, not an exhaustive dump")
    suggested_adjustments: str = dspy.OutputField(
        desc="Single highest-priority change the student should make; empty if none needed"
    )


_predict_risk = dspy.ChainOfThought(RiskSignature)


def _summarize(name: str, result) -> str:
    return (
        f"Verdict: {result.verdict.value}. Reasoning: {result.reasoning} "
        f"Skill gaps: {', '.join(result.skill_gaps) or 'None'}. "
        f"Suggested adjustments: {result.suggested_adjustments or 'None'}."
    )


def analyze_risk(
    feasibility: FeasibilityResult,
    scope: ScopeResult,
    technology: TechnologyResult,
    timeline: TimelineResult,
) -> RiskResult:
    """
    The main entry point for the Risk Agent. Pure function: takes the
    upstream agents' results, returns a structured risk assessment.
    """
    ensure_dspy_configured()

    # Still assembled the same way, so aggregated_skill_gaps/missing_inputs
    # (computed below, not asked of the model) match exactly what the
    # old prompt-based pass-through was supposed to produce.
    payload = assemble_risk_input(feasibility, scope, technology, timeline)

    prediction = _predict_risk(
        feasibility_summary=_summarize("Feasibility", feasibility),
        scope_summary=_summarize("Scope", scope),
        technology_summary=_summarize("Technology", technology),
        timeline_summary=_summarize("Timeline", timeline),
    )

    return RiskResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        risks=list(prediction.risks),
        aggregated_skill_gaps=payload["combined_skill_gaps"],
        suggested_adjustments=prediction.suggested_adjustments,
        missing_inputs=payload["combined_missing_inputs"],
    )
