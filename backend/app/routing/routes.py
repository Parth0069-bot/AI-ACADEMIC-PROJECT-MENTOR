"""
Route definitions for the semantic router.

Each route is a short list of representative utterances -- not
keywords, actual example prompts -- that anchor what "simple" and
"complex" look like in embedding space. Classification works by
embedding the incoming prompt and finding its nearest exemplar
across both lists (see semantic_router.py); the exemplar's route
wins.

This is the same nearest-exemplar approach popularized by the
open-source `semantic-router` library, adapted here to reuse this
project's own local sentence-transformers embedder instead of
pulling in a new dependency.

Tuning these lists (adding more exemplars, or ones drawn from your
own real traffic) is the main way to improve routing accuracy over
time -- more so than adjusting the confidence threshold.
"""

FAST_TIER_EXEMPLARS: list[str] = [
    "What does this term mean?",
    "Summarize this in one sentence.",
    "What's the status of my project?",
    "When is my deadline?",
    "Fix the typo in my project title.",
    "List the technologies I should learn for this.",
    "What's a good name for this feature?",
    "Can you rephrase this sentence?",
    "Is Python a good language for beginners?",
    "What's the difference between REST and GraphQL, briefly?",
    "Remind me what MQTT stands for.",
    "How do I install this package?",
    "What's next on my checklist?",
    "Give me a quick example of a for loop in Python.",
]

DEEP_TIER_EXEMPLARS: list[str] = [
    "Analyze the technical risks and trade-offs of this system architecture.",
    "Compare these three approaches in depth and recommend the best one with justification.",
    "Synthesize these three expert assessments into one coherent recommendation.",
    "Design a scalable architecture for this distributed system, considering failure modes.",
    "Walk me through a detailed feasibility analysis considering timeline, skills, and technical constraints.",
    "Explain step by step why this approach might fail and how to mitigate each risk.",
    "Help me think through the trade-offs between these two database schemas for my project.",
    "Given my current skills and this timeline, what's the most realistic way to de-risk this project?",
    "Debug why this distributed system is inconsistent under concurrent writes and propose a fix.",
    "Critically evaluate my project's scope against my team's skills and suggest what to cut.",
    "What are the second-order consequences of choosing this tech stack for a project this size?",
    "Reconcile the conflicting feedback from my risk and feasibility reviews into one plan.",
]
