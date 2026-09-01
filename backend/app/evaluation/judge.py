"""
The Judge: a secondary DSPy signature that scores a primary agent's
output against a written rubric, independent of whichever model or
tier produced that output.

Deliberately runs on its own model (JUDGE_MODEL / get_judge_lm(), see
app/core/dspy_config.py) rather than reusing the default/fast/deep
tier that answered -- a model grading its own output is a well-known
source of inflated self-assessment, so the judge is intentionally a
separate call with its own configurable model.
"""

import dspy

from app.core.dspy_config import get_judge_lm
from app.schemas.evaluation import EvaluationResult, JudgeVerdict


class JudgeSignature(dspy.Signature):
    """You are the Judge in an LLM-as-a-Judge evaluation pipeline for an AI academic project
    mentor platform. You are given the INPUT an agent received and the OUTPUT it produced from
    that input. Score the output against this written rubric. You did not produce this output
    and have no stake in it looking good -- score it as a skeptical, independent auditor would.

    Score each of the three dimensions 0-100 using these bands:

    HALLUCINATION SCORE (100 = fully grounded, 0 = fabricated):
    - 90-100: every claim traces to the input, or is a clearly reasonable inference from it. No
      invented technologies, numbers, statistics, or facts not present in or derivable from the
      input.
    - 70-89: minor unsupported embellishment (a specific detail not present in the input) that
      does not change whether the output's core verdict is valid.
    - 40-69: at least one claim that is not supported by the input and could materially mislead
      the student (e.g. flagging a skill gap in a technology the input never mentions, or citing
      a specific number/fact not derivable from the input).
    - 0-39: the verdict or major claims are substantially fabricated, or directly contradict
      facts stated in the input.

    RELEVANCE SCORE (100 = fully specific to this exact input, 0 = irrelevant):
    - 90-100: directly and specifically engages with this project's actual data; no generic
      boilerplate that could apply to any project.
    - 70-89: mostly specific, but includes some generic filler.
    - 40-69: significant portions are generic advice only loosely tied to the specific input.
    - 0-39: the output reads as though it could have been produced without reading the input at
      all.

    LOGICAL SOUNDNESS SCORE (100 = fully internally consistent, 0 = self-contradictory):
    - 90-100: the verdict, any confidence score, and the stated reasoning are fully consistent
      with each other; no internal contradictions.
    - 70-89: minor tension, e.g. a confidence score slightly higher than the reasoning alone
      would support.
    - 40-69: a clear internal contradiction -- e.g. the reasoning describes a severe problem but
      the verdict says everything is fine, or two listed items directly conflict.
    - 0-39: the verdict and the reasoning substantially contradict each other.

    OVERALL SCORE: your holistic judgment, not a mechanical average of the three above -- weigh
    hallucination most heavily, since a confidently fabricated verdict is the most harmful
    failure mode for a platform students and faculty rely on for real decisions.

    VERDICT: 'Pass' if overall_score is 75 or above, 'Needs Review' if 40-74, 'Fail' if below
    40. Apply this mapping directly; do not deviate from it.

    List flagged_issues as short, specific, actionable notes (e.g. "Cited 'Kubernetes' as a
    skill gap; input never mentions Kubernetes or any orchestration tool"), not vague
    restatements of a low score. Leave it empty only if you genuinely found nothing to flag.
    """

    agent_name: str = dspy.InputField(desc="Which agent produced this output, e.g. 'feasibility', 'risk'")
    input_context: str = dspy.InputField(desc="What the agent was given (project data, upstream results, etc.)")
    agent_output: str = dspy.InputField(desc="The structured result the agent produced from that input")

    hallucination_score: int = dspy.OutputField(desc="0-100, per the rubric above")
    relevance_score: int = dspy.OutputField(desc="0-100, per the rubric above")
    logical_soundness_score: int = dspy.OutputField(desc="0-100, per the rubric above")
    overall_score: int = dspy.OutputField(desc="0-100, holistic, weighted toward hallucination")
    verdict: JudgeVerdict = dspy.OutputField(desc="Derived mechanically from overall_score per the rubric")
    flagged_issues: list[str] = dspy.OutputField(desc="Specific, actionable issues; empty if none found")


_predict_judge = dspy.ChainOfThought(JudgeSignature)


def run_judge(agent_name: str, input_context: str, agent_output: str) -> EvaluationResult:
    """
    Runs the Judge on one agent's (input, output) pair. Always runs
    against the judge's own model via dspy.context, regardless of
    which tier/model dspy.settings currently has configured as
    default -- callers don't need to manage this themselves.
    """

    with dspy.context(lm=get_judge_lm()):
        prediction = _predict_judge(
            agent_name=agent_name,
            input_context=input_context,
            agent_output=agent_output,
        )

    return EvaluationResult(
        agent_name=agent_name,
        hallucination_score=int(prediction.hallucination_score),
        relevance_score=int(prediction.relevance_score),
        logical_soundness_score=int(prediction.logical_soundness_score),
        overall_score=int(prediction.overall_score),
        verdict=prediction.verdict,
        flagged_issues=list(prediction.flagged_issues),
        judge_reasoning=prediction.reasoning,
    )
