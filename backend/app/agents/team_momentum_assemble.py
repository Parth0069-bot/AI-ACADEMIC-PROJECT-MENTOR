"""
Prepares the combined input payload for the Team Momentum Agent.
"""

from collections import Counter

from app.schemas.idea import IdeaWithStudentContext
from app.schemas.timeline import TimelineResult
from app.schemas.team_momentum import TeamMomentumIn


def assemble_team_momentum_input(
    context: IdeaWithStudentContext,
    timeline: TimelineResult,
    checkins: list[dict],
    commit_data: TeamMomentumIn,
) -> dict:
    """Combine the declared team size, the Timeline Agent's week-by-week
    plan, check-in history, and raw commit activity into one payload.

    Does a first-pass numeric rollup (commit count per contributor,
    earliest/latest commit timestamps) so the agent isn't left to count
    a potentially long raw commit list itself -- it should reason about
    the pattern, not re-derive the arithmetic.
    """
    idea = context.idea

    commits_sorted = sorted(commit_data.commits, key=lambda c: c.timestamp)
    per_contributor = Counter(c.contributor for c in commits_sorted)
    total_commits = len(commits_sorted)

    contributor_rollup = [
        {
            "contributor": contributor,
            "commit_count": count,
            "commit_share_percent": round(100 * count / total_commits) if total_commits else 0,
        }
        for contributor, count in per_contributor.most_common()
    ]

    checkin_summaries = [
        {
            "week_number": c.get("week_number"),
            "status": c.get("status"),
            "completed_tasks": c.get("completed_tasks"),
            "blockers": c.get("blockers"),
        }
        for c in checkins
    ]

    return {
        "declared_team_size": idea.team_size,
        "total_commits": total_commits,
        "contributor_rollup": contributor_rollup,
        "raw_commits": [
            {
                "contributor": c.contributor,
                "timestamp": c.timestamp.isoformat(),
                "message": c.message,
            }
            for c in commits_sorted
        ],
        "repo_url": commit_data.repo_url,
        "total_duration": timeline.total_duration,
        "weeks": timeline.weeks,
        "milestones": timeline.milestones,
        "checkin_history": checkin_summaries if checkin_summaries else "No check-ins recorded yet.",
    }
