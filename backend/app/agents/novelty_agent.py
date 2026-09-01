"""
Novelty & Differentiation Agent. Rewritten on DSPy.

Assesses how distinct a submitted project idea is compared to (a)
other ideas already submitted in the same cohort, if any are
available, and (b) well-known existing tools/projects in the same
domain, drawing on the model's own knowledge when no cohort data
is available.
"""

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext, CohortIdeaSummary
from app.schemas.scope import ScopeResult
from app.schemas.novelty import NoveltyResult, NoveltyVerdict, ClosestMatch


class NoveltySignature(dspy.Signature):
    """You are the Novelty & Differentiation Agent inside an AI academic project mentor
    platform. Assess how distinct this specific project idea is compared to other project
    ideas already submitted in the same academic cohort/dataset, and compared to well-known
    existing tools or projects you're aware of in this domain.

    Do not penalize a project just for sharing a domain with another team (e.g. two flood-
    monitoring projects aren't automatically redundant) -- judge overlap on the actual
    approach, data source, or core mechanism, not the general theme. If no other cohort ideas
    are provided, rely on your own knowledge of common/well-known project patterns in this
    domain instead of inventing overlap that isn't there.

    Ground every claim in something specific from the provided idea or the comparison set --
    never say "similar to existing work" without naming what the overlap actually is.
    """

    project_title: str = dspy.InputField()
    domain: str = dspy.InputField()
    description: str = dspy.InputField()
    scope_in_scope: str = dspy.InputField(desc="Comma-separated list of in-scope features")
    scope_out_of_scope: str = dspy.InputField(desc="Comma-separated list of out-of-scope items")
    scope_core_user_story: str = dspy.InputField()
    cohort_ideas: str = dspy.InputField(
        desc="Other project ideas in the same cohort (title, domain, description), one per "
        "line, or a note that none are available"
    )

    verdict: NoveltyVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences explaining the verdict, naming specific overlaps if any")
    closest_matches: list[ClosestMatch] = dspy.OutputField()
    differentiation_suggestions: list[str] = dspy.OutputField(
        desc="Concrete, specific changes that would make this idea more distinct"
    )
    unique_angle: str = dspy.OutputField(
        desc="1-2 sentences: the single most defensible, differentiated angle this specific team already has, even if small"
    )
    missing_inputs: list[str] = dspy.OutputField(
        desc="Fields this analysis had to assume, e.g. 'no cohort comparison data provided'"
    )


_predict_novelty = dspy.ChainOfThought(NoveltySignature)


def analyze_novelty(
    context: IdeaWithStudentContext,
    scope: ScopeResult,
    cohort_ideas: list[CohortIdeaSummary],
) -> NoveltyResult:
    """
    The main entry point for the Novelty Agent. Pure function: takes the
    idea, the Scope Agent's own result, and whatever cohort comparison
    data is available, returns a structured novelty assessment.
    """
    ensure_dspy_configured()
    idea = context.idea

    if cohort_ideas:
        cohort_block = "\n".join(
            f'"{c.title}" (domain: {c.domain or "Not specified"}): {c.description}'
            for c in cohort_ideas
        )
    else:
        cohort_block = "None provided -- no other cohort ideas are available for comparison."

    prediction = _predict_novelty(
        project_title=idea.title,
        domain=idea.domain or "Not specified",
        description=idea.description,
        scope_in_scope=", ".join(scope.in_scope) or "Not specified",
        scope_out_of_scope=", ".join(scope.out_of_scope) or "Not specified",
        scope_core_user_story=scope.core_user_story or "Not specified",
        cohort_ideas=cohort_block,
    )

    return NoveltyResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        closest_matches=list(prediction.closest_matches),
        differentiation_suggestions=list(prediction.differentiation_suggestions),
        unique_angle=prediction.unique_angle,
        missing_inputs=list(prediction.missing_inputs),
    )
