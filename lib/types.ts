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

export type IdeaStatus = "pending" | "submitted" | "under_review" | "approved";
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

