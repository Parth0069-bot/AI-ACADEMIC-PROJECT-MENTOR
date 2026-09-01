export interface StudentProfile {
  id: string;
  supabase_user_id: string;
  name: string;
  email: string;
  department: string | null;
  phone: string | null;
  year_of_study: string | null;
  university: string | null;
  created_at: string;
}

export type FluencyLevel = "beginner" | "intermediate" | "advanced";

export interface SkillAssessment {
  id: string;
  student_id: string;
  tech_stack: string;
  fluency_level: FluencyLevel;
  submitted_at: string;
}

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface ProjectIdea {
  id: string;
  student_id: string;
  title: string;
  description: string;
  tech_stack: string | null;
  status: string;
  domain: string | null;
  objectives: string | null;
  difficulty: Difficulty | null;
  duration: string | null;
  team_size: number | null;
  created_at: string;
  deleted_at: string | null;
}

// Milestone 2: results of the backend's 4 chained agents, read from the
// `agent_feedback` table (written by the FastAPI backend, read directly
// here via Supabase since RLS already allows a student to see feedback
// on their own ideas).
export type AgentName =
  | "feasibility_agent"
  | "scope_agent"
  | "technology_agent"
  | "timeline_agent"
  | "risk_agent"
  | "novelty_agent"
  | "viva_agent"
  | "skill_development_agent"
  | "team_momentum_agent"
  | "calibration_agent";

export type FeasibilityVerdict = "Feasible" | "Feasible with Adjustments" | "Not Feasible";

export interface AgentFeedback {
  id: string;
  idea_id: string;
  agent_name: AgentName | string;
  verdict: FeasibilityVerdict | string | null;
  confidence_score: number | null;
  reasoning: string | null;
  skill_gaps: string[] | null;
  suggested_adjustments: string | null;
  model_used: string | null;
  created_at: string;
  // Full structured result specific to whichever agent produced this row
  // (in_scope/out_of_scope for Scope, stack for Technology, weeks for
  // Timeline). Null for rows saved before this column existed.
  details: Record<string, unknown> | null;
}

// ---------- Faculty Command Center ----------
// Backed by the `faculty` / `faculty_feedback` tables (see
// supabase/migration.sql). Row visibility on `project_ideas` is
// domain-scoped by RLS: a 'CSE' faculty member's queries return every
// project; any other domain's queries return only matching-domain
// rows. This is enforced server-side -- these types don't encode the
// rule, they just describe what a given faculty session can see.

// 'CSE' is the one domain value with special meaning in RLS (see
// current_faculty_domain() in the migration) -- faculty in this
// domain see every project globally rather than only their own.
export const GLOBAL_VIEW_DOMAIN = "CSE";

export interface FacultyProfile {
  id: string;
  supabase_user_id: string;
  name: string;
  email: string;
  domain: string;
  created_at: string;
}

export interface FacultyFeedback {
  id: string;
  idea_id: string;
  faculty_id: string;
  comments: string;
  rating: number | null;
  created_at: string;
}
