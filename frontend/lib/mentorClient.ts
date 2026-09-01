/**
 * Client for the Milestone 3 mentor endpoints: conversational chat,
 * weekly check-ins, and on-demand document generation.
 *
 * Follows the same pattern as lib/backendClient.ts -- everything here
 * requires the AI pipeline (Gemini), so it has to go through the
 * FastAPI backend rather than straight through Supabase.
 */

import { BackendError } from "@/lib/backendClient";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

async function requestJSON<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
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

// ---- Chat ----

export interface ChatMessage {
  id?: string;
  role: "student" | "mentor";
  message: string;
  created_at?: string;
}

export interface MentorChatResponse {
  idea_id: string;
  student_id: string;
  reply: string;
  stored: boolean;
}

export async function fetchChatHistory(ideaId: string): Promise<ChatMessage[]> {
  return requestJSON<ChatMessage[]>(`/mentor/chat/${ideaId}`, { method: "GET" });
}

export async function sendMentorMessage(
  ideaId: string,
  message: string
): Promise<MentorChatResponse> {
  return requestJSON<MentorChatResponse>(`/mentor/chat/${ideaId}`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ---- Weekly check-ins ----

export type CheckinStatus = "on_track" | "behind" | "blocked";

export interface WeeklyCheckinInput {
  week_number: number;
  status: CheckinStatus;
  planned_tasks?: string;
  completed_tasks: string;
  blockers?: string;
  student_notes?: string;
}

export interface WeeklyCheckinResult {
  idea_id: string;
  student_id: string;
  week_number: number;
  status: string;
  mentor_message: string;
  adjusted_plan: string;
  timeline_adjusted: boolean;
  risk_rerun_triggered: boolean;
  stored: boolean;
  checkin_id: string | null;
}

export interface WeeklyCheckinOut {
  id: string;
  idea_id: string;
  student_id: string;
  week_number: number;
  status: string;
  planned_tasks: string | null;
  completed_tasks: string;
  blockers: string | null;
  student_notes: string | null;
  mentor_message: string | null;
  adjusted_plan: string | null;
  timeline_adjusted: boolean;
  created_at: string | null;
}

export async function fetchCheckinHistory(ideaId: string): Promise<WeeklyCheckinOut[]> {
  return requestJSON<WeeklyCheckinOut[]>(`/mentor/checkins/${ideaId}`, { method: "GET" });
}

export async function submitWeeklyCheckin(
  ideaId: string,
  payload: WeeklyCheckinInput
): Promise<WeeklyCheckinResult> {
  return requestJSON<WeeklyCheckinResult>(`/mentor/checkin/${ideaId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- Document generation ----

export type DocumentType = "synopsis" | "methodology" | "progress_report";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  synopsis: "Synopsis",
  methodology: "Methodology",
  progress_report: "Progress Report",
};

/**
 * Generates a .docx on the backend and triggers a browser download.
 * Not JSON -- the backend streams a file, so this bypasses requestJSON
 * and handles the blob directly.
 */
export async function downloadDocument(ideaId: string, documentType: DocumentType): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/documents/${documentType}/${ideaId}`);
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

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${documentType}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
