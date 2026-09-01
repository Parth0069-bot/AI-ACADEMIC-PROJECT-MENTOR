/**
 * Thin client for calling the FastAPI backend (the agents service),
 * as opposed to lib/supabaseClient.ts which talks to Supabase directly.
 *
 * Reads (existing agent_feedback) go straight through Supabase, since
 * RLS already permits a student to read feedback on their own ideas —
 * no need to round-trip through the backend just to read data it
 * already wrote.
 *
 * Writes that require actually calling an AI model (running the
 * Feasibility Agent) have to go through the backend, since that's the
 * only place with a Gemini API key.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

interface CommonAgentFields {
  confidence_score: number;
  reasoning: string;
  skill_gaps: string[];
  suggested_adjustments: string;
  /** Fields the student left blank at submission that this analysis had to assume (e.g. "tech_stack", "duration"). */
  missing_inputs: string[];
}

export interface FeasibilityRunResult {
  idea_id: string;
  student_id: string;
  result: CommonAgentFields & {
    verdict: "Feasible" | "Feasible with Adjustments" | "Not Feasible";
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export interface ScopeRunResult {
  idea_id: string;
  student_id: string;
  result: CommonAgentFields & {
    verdict: "Well-Scoped" | "Needs Narrowing" | "Too Ambitious";
    in_scope: string[];
    out_of_scope: string[];
    core_user_story: string;
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export interface TechnologyRunResult {
  idea_id: string;
  student_id: string;
  result: CommonAgentFields & {
    verdict: "Stack Approved" | "Stack Needs Adjustment" | "Consider Alternative";
    stack: string[];
    alternative: string;
    learning_curve: string;
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export interface TimelineRunResult {
  idea_id: string;
  student_id: string;
  result: CommonAgentFields & {
    verdict: "Realistic Timeline" | "Tight Timeline" | "Unrealistic Timeline";
    total_duration: string;
    weeks: string[];
    milestones: string[];
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export interface RiskRunResult {
  idea_id: string;
  student_id: string;
  result: CommonAgentFields & {
    verdict: "Low Risk" | "Moderate Risk" | "High Risk";
    risks: {
      category: string;
      description: string;
      likelihood: string;
      impact: string;
      source_agent: string;
      mitigation: string;
    }[];
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export interface NoveltyRunResult {
  idea_id: string;
  student_id: string;
  result: {
    verdict: "Highly Distinct" | "Some Overlap" | "Significant Overlap";
    confidence_score: number;
    reasoning: string;
    closest_matches: {
      title: string;
      overlap_description: string;
      similarity: "High" | "Medium" | "Low";
    }[];
    differentiation_suggestions: string[];
    unique_angle: string;
    missing_inputs: string[];
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
  cohort_ideas_compared: number;
}

export interface VivaPanelRunResult {
  idea_id: string;
  student_id: string;
  result: {
    panel: {
      persona: "The Skeptic" | "The Technical Examiner" | "The Impact Examiner";
      question: string;
      why_they_ask_this: string;
      model_answer: string;
      answer_confidence: "Strong" | "Adequate" | "Weak -- needs more preparation";
    }[];
    overall_readiness: "Ready" | "Needs Practice" | "High Risk in Defense";
    weakest_point_to_prepare: string;
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
  checkins_considered: number;
}

export interface SkillDevelopmentRunResult {
  idea_id: string;
  student_id: string;
  result: CommonAgentFields & {
    verdict: "Gaps Are Manageable" | "Gaps Need Front-Loading" | "Gaps Threaten the Timeline";
    learning_path: {
      skill: string;
      blocks_feature: string;
      priority: "Must Learn Deeply" | "Learn Just Enough" | "Nice to Have";
      suggested_approach: string;
      estimated_hours: string;
    }[];
    sequencing_note: string;
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export interface TeamMomentumCommitRecord {
  contributor: string;
  timestamp: string;
  message: string;
}

export interface TeamMomentumIn {
  repo_url?: string | null;
  commits: TeamMomentumCommitRecord[];
}

export interface TeamMomentumRunResult {
  idea_id: string;
  student_id: string;
  result: {
    verdict: "Healthy Momentum" | "Uneven Contribution" | "Last-Minute Pattern" | "Insufficient Data";
    confidence_score: number;
    reasoning: string;
    contribution_breakdown: { contributor: string; commit_share_percent: number; note: string }[];
    timing_pattern: string;
    checkin_alignment: string;
    suggested_adjustments: string;
    missing_inputs: string[];
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
  commits_analyzed: number;
  checkins_considered: number;
}

export interface CalibrationRunResult {
  idea_id: string;
  student_id: string;
  result: {
    verdict: "Well-Calibrated Pipeline" | "Mixed Calibration" | "Overconfident Pipeline";
    confidence_score: number;
    reasoning: string;
    agent_calibration: {
      agent_name: string;
      original_verdict: string;
      original_confidence: number;
      held_up: "Confirmed" | "Contradicted" | "Not Enough Evidence Yet";
      evidence: string;
    }[];
    most_reliable_agent: string;
    recommendation: string;
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
  agents_with_history: number;
  checkins_considered: number;
}

export type ProjectHealthStatus = "On Track" | "Needs Attention" | "At Risk" | "Insufficient Data";

export interface ProjectHealthIndicator {
  idea_id: string;
  title: string;
  domain: string | null;
  student_id: string;
  student_name: string;
  student_email: string | null;

  status: ProjectHealthStatus;
  health_score: number;
  flags: string[];

  feasibility_verdict: string | null;
  risk_verdict: string | null;
  momentum_verdict: string | null;
  timeline_verdict: string | null;

  latest_checkin_status: string | null;
  latest_checkin_week: number | null;
  planned_weeks: number | null;
  checkins_count: number;
  agents_run: number;
  days_since_last_activity: number | null;

  has_digest: boolean;
  latest_digest_headline: string | null;
  latest_digest_generated_at: string | null;

  created_at: string | null;
}

export interface CohortHealthSummary {
  total_projects: number;
  on_track: number;
  needs_attention: number;
  at_risk: number;
  insufficient_data: number;
  average_health_score: number;
}

export interface FacultyOverviewResult {
  generated_at: string;
  summary: CohortHealthSummary;
  projects: ProjectHealthIndicator[];
}

export interface MentorDigestResult {
  headline: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommended_action: string;
  missing_inputs: string[];
}

export interface MentorDigestRunResult {
  idea_id: string;
  student_id: string;
  result: MentorDigestResult;
  health_status: ProjectHealthStatus;
  health_score: number;
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

/** Shape of a stored agent_feedback row, as returned by GET /faculty/digest/{ideaId}. */
export interface StoredMentorDigest {
  id: string;
  idea_id: string;
  agent_name: string;
  verdict: string | null;
  confidence_score: number | null;
  reasoning: string | null;
  suggested_adjustments: string | null;
  model_used: string | null;
  created_at: string | null;
  details: MentorDigestResult | null;
}

export class BackendError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getFromBackend<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`);
  } catch {
    throw new BackendError(
      "Couldn't reach the backend. Is it running? (uvicorn app.main:app --reload)",
      0
    );
  }

  if (!response.ok) {
    let detail = `Backend returned ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new BackendError(detail, response.status);
  }

  return response.json();
}

async function postToAgent<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, { method: "POST" });
  } catch {
    throw new BackendError(
      "Couldn't reach the backend. Is it running? (uvicorn app.main:app --reload)",
      0
    );
  }

  if (!response.ok) {
    let detail = `Backend returned ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new BackendError(detail, response.status);
  }

  return response.json();
}

async function postToAgentWithBody<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BackendError(
      "Couldn't reach the backend. Is it running? (uvicorn app.main:app --reload)",
      0
    );
  }

  if (!response.ok) {
    let detail = `Backend returned ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new BackendError(detail, response.status);
  }

  return response.json();
}

export async function runFeasibilityAnalysis(ideaId: string): Promise<FeasibilityRunResult> {
  return postToAgent<FeasibilityRunResult>(`/agents/feasibility/${ideaId}`);
}

/** Requires the Feasibility agent to have already been run for this idea. */
export async function runScopeAnalysis(ideaId: string): Promise<ScopeRunResult> {
  return postToAgent<ScopeRunResult>(`/agents/scope/${ideaId}`);
}

/** Requires the Scope agent to have already been run for this idea. */
export async function runTechnologyAnalysis(ideaId: string): Promise<TechnologyRunResult> {
  return postToAgent<TechnologyRunResult>(`/agents/technology/${ideaId}`);
}

/** Requires both the Scope and Technology agents to have already been run for this idea. */
export async function runTimelineAnalysis(ideaId: string): Promise<TimelineRunResult> {
  return postToAgent<TimelineRunResult>(`/agents/timeline/${ideaId}`);
}

/** Requires all four previous agents to have been run. */
export async function runRiskAnalysis(ideaId: string): Promise<RiskRunResult> {
  return postToAgent<RiskRunResult>(`/agents/risk/${ideaId}`);
}

/** Requires the Scope agent to have already been run for this idea. */
export async function runNoveltyAnalysis(ideaId: string): Promise<NoveltyRunResult> {
  return postToAgent<NoveltyRunResult>(`/agents/novelty/${ideaId}`);
}

/** Requires Feasibility, Scope, Technology, Timeline, and Risk to have already been run. */
export async function runVivaPanelAnalysis(ideaId: string): Promise<VivaPanelRunResult> {
  return postToAgent<VivaPanelRunResult>(`/agents/viva/${ideaId}`);
}

/** Requires Scope, Timeline, and Risk to have already been run. */
export async function runSkillDevelopmentAnalysis(ideaId: string): Promise<SkillDevelopmentRunResult> {
  return postToAgent<SkillDevelopmentRunResult>(`/agents/skill-development/${ideaId}`);
}

/**
 * Requires the Timeline agent to have already been run. Unlike the other
 * agents, this one needs commit activity supplied in the request body —
 * pass an empty `commits` array if no repository is connected, which is
 * valid input (the agent returns "Insufficient Data" rather than erroring).
 */
export async function runTeamMomentumAnalysis(
  ideaId: string,
  commitData: TeamMomentumIn
): Promise<TeamMomentumRunResult> {
  return postToAgentWithBody<TeamMomentumRunResult>(`/agents/team-momentum/${ideaId}`, commitData);
}

/** Requires the Risk agent to have already been run at least once. */
export async function runCalibrationAnalysis(ideaId: string): Promise<CalibrationRunResult> {
  return postToAgent<CalibrationRunResult>(`/agents/calibration/${ideaId}`);
}

/**
 * Every active project in the cohort with a deterministically computed
 * health status/score -- powers the Faculty Monitoring Dashboard. No
 * AI call happens on the backend for this, so it's safe to call often.
 */
export async function fetchFacultyOverview(): Promise<FacultyOverviewResult> {
  return getFromBackend<FacultyOverviewResult>("/faculty/overview");
}

/** The most recently generated Mentor Digest for one project, or null if none exists yet. */
export async function fetchLatestMentorDigest(ideaId: string): Promise<StoredMentorDigest | null> {
  return getFromBackend<StoredMentorDigest | null>(`/faculty/digest/${ideaId}`);
}

/**
 * Generates a fresh, faculty-facing Mentor Digest for one project.
 * Nothing needs to have run first -- an early-stage project with no
 * agent runs or check-ins is valid input, and the digest says so.
 */
export async function runMentorDigest(ideaId: string): Promise<MentorDigestRunResult> {
  return postToAgent<MentorDigestRunResult>(`/agents/mentor-digest/${ideaId}`);
}

/** Soft-deletes a project idea. */
export async function deleteIdea(ideaId: string): Promise<{ message: string }> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/ideas/${ideaId}`, { method: "DELETE" });
  } catch {
    throw new BackendError(
      "Couldn't reach the backend. Is it running? (uvicorn app.main:app --reload)",
      0
    );
  }

  if (!response.ok) {
    let detail = `Backend returned ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new BackendError(detail, response.status);
  }

  return response.json();
}

/** Restores a soft-deleted project idea. */
export async function restoreIdea(ideaId: string): Promise<{ message: string }> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/ideas/${ideaId}/restore`, { method: "PATCH" });
  } catch {
    throw new BackendError(
      "Couldn't reach the backend. Is it running? (uvicorn app.main:app --reload)",
      0
    );
  }

  if (!response.ok) {
    let detail = `Backend returned ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new BackendError(detail, response.status);
  }

  return response.json();
}

/** Permanently deletes a project idea and its feedback. */
export async function hardDeleteIdea(ideaId: string): Promise<{ message: string }> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/ideas/${ideaId}/hard`, { method: "DELETE" });
  } catch {
    throw new BackendError(
      "Couldn't reach the backend. Is it running? (uvicorn app.main:app --reload)",
      0
    );
  }

  if (!response.ok) {
    let detail = `Backend returned ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new BackendError(detail, response.status);
  }

  return response.json();
}
