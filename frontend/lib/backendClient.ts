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

export interface FeasibilityRunResult {
  idea_id: string;
  student_id: string;
  result: {
    verdict: string;
    confidence_score: number;
    reasoning: string;
    skill_gaps: string[];
    suggested_adjustments: string;
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export class BackendError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function runFeasibilityAnalysis(ideaId: string): Promise<FeasibilityRunResult> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/agents/feasibility/${ideaId}`, {
      method: "POST",
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
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new BackendError(detail, response.status);
  }

  return response.json();
}
