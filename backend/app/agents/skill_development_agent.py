"""
Skill Development Agent. Rewritten on DSPy.

Takes the aggregated skill_gaps already identified by the upstream
agents (via the Risk Agent's deduplicated union) and turns them into
a short, realistic, timeline-fitting learning path -- not a generic
course catalog.
"""

import json

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.scope import ScopeResult
from app.schemas.timeline import TimelineResult
from app.schemas.risk import RiskResult
from app.schemas.skill_development import SkillDevelopmentResult, SkillDevelopmentVerdict, LearningPathItem
from app.agents.skill_development_assemble import assemble_skill_development_input


class SkillDevelopmentSignature(dspy.Signature):
    """You are the Skill Development Agent inside an AI academic project mentor platform. Take
    the aggregated skill gaps already identified by upstream agents (Feasibility, Scope,
    Technology, Timeline, Risk) for this specific project and turn them into a short, realistic
    learning path the student can actually follow inside their project timeline -- not a
    generic course catalog.

    Every recommendation must tie back to the SPECIFIC in-scope feature that needs that skill.
    Prioritize ruthlessly: a student with 4 skill gaps and a 6-week timeline cannot deep-learn
    all 4 -- rank them by how blocking each gap is to the core user story, and be explicit that
    lower-priority gaps should be learned "just enough to ship," not mastered.

    Prefer free, specific, named resources (official docs, one well-known free course/tutorial)
    over vague suggestions like "watch some YouTube videos." If you don't know a specific
    resource confidently, describe what to search for rather than inventing a fake course name
    or URL.
    """

    aggregated_skill_gaps: str = dspy.InputField(desc="JSON list of skill gaps to plan around")
    in_scope: str = dspy.InputField(desc="JSON list of in-scope features")
    core_user_story: str = dspy.InputField()
    total_duration: str = dspy.InputField()
    weeks: str = dspy.InputField(desc="JSON list, the week-by-week plan")
    milestones: str = dspy.InputField(desc="JSON list of milestones")

    verdict: SkillDevelopmentVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences on how these gaps interact with the actual timeline")
    learning_path: list[LearningPathItem] = dspy.OutputField(
        desc="Ranked list of skill gaps turned into a realistic, timeline-fitting learning path"
    )
    sequencing_note: str = dspy.OutputField(
        desc="1-2 sentences: what order to learn these in relative to the week-by-week plan"
    )
    missing_inputs: list[str] = dspy.OutputField()


_predict_skill_development = dspy.ChainOfThought(SkillDevelopmentSignature)


def analyze_skill_development(
    scope: ScopeResult,
    timeline: TimelineResult,
    risk: RiskResult,
) -> SkillDevelopmentResult:
    """
    The main entry point for the Skill Development Agent. Pure function:
    takes the Scope, Timeline, and Risk agents' own results, returns a
    structured, prioritized learning path.
    """
    ensure_dspy_configured()

    payload = assemble_skill_development_input(scope, timeline, risk)

    prediction = _predict_skill_development(
        aggregated_skill_gaps=json.dumps(payload["aggregated_skill_gaps"]),
        in_scope=json.dumps(payload["in_scope"]),
        core_user_story=payload["core_user_story"] or "Not specified",
        total_duration=payload["total_duration"] or "Not specified",
        weeks=json.dumps(payload["weeks"]),
        milestones=json.dumps(payload["milestones"]),
    )

    return SkillDevelopmentResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        learning_path=list(prediction.learning_path),
        sequencing_note=prediction.sequencing_note,
        missing_inputs=list(prediction.missing_inputs),
    )
