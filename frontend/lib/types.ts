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
}

// Milestone 2, Task 1: result of the backend's Feasibility Analysis Agent,
// read from the `agent_feedback` table (written by the FastAPI backend,
// read directly here via Supabase since RLS already allows a student to
// see feedback on their own ideas).
export type FeasibilityVerdict = "Feasible" | "Feasible with Adjustments" | "Not Feasible";

export interface AgentFeedback {
  id: string;
  idea_id: string;
  agent_name: string;
  verdict: FeasibilityVerdict | string | null;
  confidence_score: number | null;
  reasoning: string | null;
  skill_gaps: string[] | null;
  suggested_adjustments: string | null;
  model_used: string | null;
  created_at: string;
}
