"""
Technology Recommendation Agent — Milestone 2, Task 3. Rewritten on DSPy.

Takes a project idea plus the Scope Agent's result for that same idea
and recommends a concrete, student-friendly tech stack.
"""

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult, TechnologyVerdict


class TechnologySignature(dspy.Signature):
    """You are the Technology Recommendation Agent inside an AI academic project mentor
    platform. Recommend a concrete, student-friendly tech stack for a project that has already
    been scoped.

    Prefer free and open-source tools students can run without paying, unless the student
    already proposed a stack -- in that case evaluate it against what the scope actually
    requires and suggest adjustments rather than replacing it outright. Ground every
    recommendation in what the in-scope features actually need; don't recommend a technology
    just because it's popular for this domain in general.

    Handling a missing stack: if proposed_tech_stack is "None proposed", this is not a blank
    check to invent whatever you like with full confidence. Put "tech_stack" in missing_inputs,
    and open reasoning with something like "The student did not propose a tech stack at
    submission -- the stack below is an AI suggestion, not a validation of their choice." Cap
    confidence_score at 60 or below in this case, since there is nothing of the student's to
    actually evaluate. Still fill in `stack` with a concrete, justified recommendation.
    """

    project_title: str = dspy.InputField()
    domain: str = dspy.InputField()
    proposed_tech_stack: str = dspy.InputField()
    student_skills: str = dspy.InputField(desc="One line per technology: name and self-rated fluency level")
    scope_in_scope: str = dspy.InputField(desc="Comma-separated list of in-scope features")
    scope_out_of_scope: str = dspy.InputField(desc="Comma-separated list of out-of-scope items")
    scope_core_user_story: str = dspy.InputField()

    verdict: TechnologyVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(
        desc="2-4 sentences explaining the verdict, naming it clearly if no stack was proposed"
    )
    skill_gaps: list[str] = dspy.OutputField(
        desc="Technologies in the recommended stack the student doesn't yet know"
    )
    suggested_adjustments: str = dspy.OutputField(
        desc="Concrete change to make the stack more realistic; empty string if none needed"
    )
    stack: list[str] = dspy.OutputField(desc="Recommended technologies, each with a short reason")
    alternative: str = dspy.OutputField(desc="A lighter-weight alternative stack for a low-resource situation, 1-2 lines")
    learning_curve: str = dspy.OutputField(desc="1-2 sentences on what the student will likely need to learn")
    missing_inputs: list[str] = dspy.OutputField()


_predict_technology = dspy.ChainOfThought(TechnologySignature)


def analyze_technology(context: IdeaWithStudentContext, scope: ScopeResult) -> TechnologyResult:
    """
    The main entry point for Task 3. Pure function: takes the idea +
    the Scope Agent's own result, returns a structured stack recommendation.
    """
    ensure_dspy_configured()
    idea = context.idea

    if context.skills:
        skills_text = "\n".join(f"{s.tech_stack}: {s.fluency_level}" for s in context.skills)
    else:
        skills_text = "(No skill assessment on file -- treat all technologies as unverified/unknown.)"

    prediction = _predict_technology(
        project_title=idea.title,
        domain=idea.domain or "Not specified",
        proposed_tech_stack=idea.tech_stack or "None proposed",
        student_skills=skills_text,
        scope_in_scope=", ".join(scope.in_scope) or "Not specified",
        scope_out_of_scope=", ".join(scope.out_of_scope) or "Not specified",
        scope_core_user_story=scope.core_user_story or "Not specified",
    )

    return TechnologyResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        skill_gaps=list(prediction.skill_gaps),
        suggested_adjustments=prediction.suggested_adjustments,
        stack=list(prediction.stack),
        alternative=prediction.alternative,
        learning_curve=prediction.learning_curve,
        missing_inputs=list(prediction.missing_inputs),
    )
