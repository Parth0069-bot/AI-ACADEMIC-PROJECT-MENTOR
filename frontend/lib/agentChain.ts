import {
  Sparkles,
  ListChecks,
  Cpu,
  CalendarClock,
  ShieldAlert,
  Lightbulb,
  Mic,
  GraduationCap,
  GitCommitHorizontal,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import {
  runFeasibilityAnalysis,
  runScopeAnalysis,
  runTechnologyAnalysis,
  runTimelineAnalysis,
  runRiskAnalysis,
  runNoveltyAnalysis,
  runVivaPanelAnalysis,
  runSkillDevelopmentAnalysis,
  runTeamMomentumAnalysis,
  runCalibrationAnalysis,
} from "@/lib/backendClient";
import type { AgentFeedback, AgentName } from "@/lib/types";

// The backend requires each agent's dependencies to already have a stored
// result (400 otherwise). The order below is a valid topological ordering
// of all 10 agents' dependencies:
//   feasibility_agent  -> (none)
//   scope_agent        -> feasibility_agent
//   technology_agent   -> scope_agent
//   timeline_agent     -> scope_agent, technology_agent
//   risk_agent         -> feasibility_agent, scope_agent, technology_agent, timeline_agent
//   novelty_agent      -> scope_agent
//   skill_development  -> scope_agent, timeline_agent, risk_agent
//   team_momentum      -> timeline_agent (+ commit data, supplied via a form — see AgentChainPanel)
//   viva_agent         -> feasibility_agent, scope_agent, technology_agent, timeline_agent, risk_agent
//   calibration_agent  -> risk_agent
export const AGENT_ORDER: AgentName[] = [
  "feasibility_agent",
  "scope_agent",
  "technology_agent",
  "timeline_agent",
  "risk_agent",
  "novelty_agent",
  "skill_development_agent",
  "team_momentum_agent",
  "viva_agent",
  "calibration_agent",
];

// team_momentum_agent is the only agent that needs more than an idea_id to
// run (commit activity) — AgentChainPanel renders a small form for it
// instead of a plain "run next" button, and calls onRunTeamMomentum instead
// of onRunAgent.
export const AGENT_NEEDS_INPUT_FORM: Partial<Record<AgentName, true>> = {
  team_momentum_agent: true,
};

export const AGENT_META: Record<
  AgentName,
  { label: string; actionLabel: string; loadingLabel: string; icon: LucideIcon }
> = {
  feasibility_agent: {
    label: "Feasibility",
    actionLabel: "Analyze Feasibility",
    loadingLabel: "Analyzing with AI...",
    icon: Sparkles,
  },
  scope_agent: {
    label: "Scope",
    actionLabel: "Define Scope",
    loadingLabel: "Defining scope...",
    icon: ListChecks,
  },
  technology_agent: {
    label: "Technology",
    actionLabel: "Recommend Stack",
    loadingLabel: "Choosing a stack...",
    icon: Cpu,
  },
  timeline_agent: {
    label: "Timeline",
    actionLabel: "Plan Timeline",
    loadingLabel: "Planning weeks...",
    icon: CalendarClock,
  },
  risk_agent: {
    label: "Risk",
    actionLabel: "Analyze Risk",
    loadingLabel: "Assessing risks...",
    icon: ShieldAlert,
  },
  novelty_agent: {
    label: "Novelty",
    actionLabel: "Check Novelty",
    loadingLabel: "Comparing against cohort...",
    icon: Lightbulb,
  },
  skill_development_agent: {
    label: "Skill Development",
    actionLabel: "Plan Learning Path",
    loadingLabel: "Building learning path...",
    icon: GraduationCap,
  },
  team_momentum_agent: {
    label: "Team Momentum",
    actionLabel: "Analyze Team Momentum",
    loadingLabel: "Analyzing commit activity...",
    icon: GitCommitHorizontal,
  },
  viva_agent: {
    label: "Viva Panel",
    actionLabel: "Simulate Viva Panel",
    loadingLabel: "Convening the panel...",
    icon: Mic,
  },
  calibration_agent: {
    label: "Calibration",
    actionLabel: "Run Calibration",
    loadingLabel: "Auditing past verdicts...",
    icon: Gauge,
  },
};

// The 4 backend run-result shapes only differ in `result`'s extra fields
// (in_scope, stack, weeks, ...) — everything else lines up. Callers here
// only touch the shared fields directly and read extra fields dynamically
// (via AgentDetails in AgentChainPanel.tsx), so a loose return type is fine.
export interface AgentRunResult {
  result: {
    verdict: string;
    confidence_score: number;
    reasoning: string;
    // Not every agent produces these directly (e.g. Team Momentum and
    // Novelty don't map cleanly onto skill_gaps; Viva Panel has neither —
    // see the `as unknown as` casts on AGENT_RUNNERS and the runners
    // called directly, like runTeamMomentumAnalysis).
    skill_gaps?: string[];
    suggested_adjustments?: string;
    [key: string]: unknown;
  };
  model_used: string;
  generated_at: string;
  stored: boolean;
  feedback_id: string | null;
}

export const AGENT_RUNNERS: Record<AgentName, (ideaId: string) => Promise<AgentRunResult>> = {
  feasibility_agent: runFeasibilityAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
  scope_agent: runScopeAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
  technology_agent: runTechnologyAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
  timeline_agent: runTimelineAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
  risk_agent: runRiskAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
  novelty_agent: runNoveltyAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
  skill_development_agent: runSkillDevelopmentAnalysis as unknown as (
    ideaId: string
  ) => Promise<AgentRunResult>,
  // Falls back to an empty commit list (a valid, meaningful input per the
  // backend — it returns "Insufficient Data" rather than erroring). Used
  // for the re-run icon on an existing card; the first run goes through
  // the dedicated commit-data form in AgentChainPanel instead.
  team_momentum_agent: ((ideaId: string) =>
    runTeamMomentumAnalysis(ideaId, { commits: [] })) as unknown as (
    ideaId: string
  ) => Promise<AgentRunResult>,
  viva_agent: runVivaPanelAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
  calibration_agent: runCalibrationAnalysis as unknown as (ideaId: string) => Promise<AgentRunResult>,
};

export type FeedbackByAgent = Partial<Record<AgentName, AgentFeedback>>;

export const VERDICT_META: Record<string, { className: string }> = {
  // Feasibility
  Feasible: { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Feasible with Adjustments": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Not Feasible": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Scope
  "Well-Scoped": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Needs Narrowing": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Too Ambitious": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Technology
  "Stack Approved": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Stack Needs Adjustment": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Consider Alternative": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Timeline
  "Realistic Timeline": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Tight Timeline": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Unrealistic Timeline": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Risk
  "Low Risk": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Moderate Risk": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "High Risk": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Novelty
  "Highly Distinct": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Some Overlap": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Significant Overlap": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Skill Development
  "Gaps Are Manageable": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Gaps Need Front-Loading": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Gaps Threaten the Timeline": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Team Momentum
  "Healthy Momentum": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Uneven Contribution": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Last-Minute Pattern": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  "Insufficient Data": { className: "border-ink-300 bg-canvas-alt text-ink-500" },
  // Viva Panel (uses overall_readiness as its "verdict")
  Ready: { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Needs Practice": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "High Risk in Defense": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Calibration
  "Well-Calibrated Pipeline": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Mixed Calibration": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "Overconfident Pipeline": { className: "border-coral-500 bg-coral-100 text-coral-500" },
  // Faculty Monitoring Dashboard health status (Insufficient Data is
  // shared with Team Momentum above, already covered).
  "On Track": { className: "border-mint-500 bg-mint-100 text-mint-500" },
  "Needs Attention": { className: "border-amber-500 bg-amber-100 text-amber-500" },
  "At Risk": { className: "border-coral-500 bg-coral-100 text-coral-500" },
};

export function verdictClassName(verdict: string | null | undefined): string {
  if (!verdict) return "border-ink-300 bg-canvas-alt text-ink-500";
  return VERDICT_META[verdict]?.className ?? "border-ink-300 bg-canvas-alt text-ink-500";
}
