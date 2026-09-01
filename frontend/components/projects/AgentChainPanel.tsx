"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AGENT_ORDER,
  AGENT_META,
  AGENT_NEEDS_INPUT_FORM,
  verdictClassName,
  type FeedbackByAgent,
} from "@/lib/agentChain";
import type { TeamMomentumIn } from "@/lib/backendClient";
import type { AgentFeedback, AgentName } from "@/lib/types";

const MISSING_FIELD_LABELS: Record<string, string> = {
  tech_stack: "Tech stack",
  duration: "Timeline / duration",
  difficulty: "Difficulty",
  team_size: "Team size",
  domain: "Domain",
  objectives: "Objectives",
};

function friendlyFieldName(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

/**
 * Shown at the top of a stage card whenever the agent flagged fields the
 * student left blank at submission — makes it unmistakable that what
 * follows (stack/timeline/etc) is an AI suggestion filling a gap, not a
 * judgment of something the student actually provided.
 */
function MissingInputsCallout({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null;
  const list = fields.map(friendlyFieldName).join(", ");

  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-100 px-3 py-2">
      <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
      <p className="text-[11px] text-ink-500 leading-relaxed">
        <span className="font-semibold text-amber-500">Not provided at submission:</span> {list}. The details
        below are AI suggestions filling that gap, not a validation of something you specified.
      </p>
    </div>
  );
}

interface AgentChainPanelProps {
  feedback: FeedbackByAgent;
  isExpanded: boolean;
  isKeyAnalyzing: (agentName: AgentName) => boolean;
  onToggleExpand: () => void;
  onRunAgent: (agentName: AgentName) => void;
  /** Team Momentum needs commit data supplied by the caller — see TeamMomentumInputForm. */
  onRunTeamMomentum: (commitData: TeamMomentumIn) => void;
}

function StageChips({ items, tone }: { items: string[]; tone: "coral" | "mint" }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full",
            tone === "coral" ? "bg-coral-100 text-coral-500" : "bg-mint-100 text-mint-600"
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function StageLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-ink-400 mb-1">{children}</p>;
}

/** Renders the fields specific to one agent's result (details), beyond the shared verdict/reasoning/skill_gaps. */
function AgentDetails({
  agentName,
  details,
  missingInputs,
}: {
  agentName: AgentName;
  details: Record<string, unknown> | null;
  missingInputs: string[];
}) {
  if (!details) return null;

  if (agentName === "scope_agent") {
    const inScope = (details.in_scope as string[]) || [];
    const outOfScope = (details.out_of_scope as string[]) || [];
    const coreUserStory = (details.core_user_story as string) || "";
    return (
      <>
        {coreUserStory && (
          <div>
            <StageLabel>CORE USER STORY</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed italic">{coreUserStory}</p>
          </div>
        )}
        {inScope.length > 0 && (
          <div>
            <StageLabel>IN SCOPE</StageLabel>
            <StageChips items={inScope} tone="mint" />
          </div>
        )}
        {outOfScope.length > 0 && (
          <div>
            <StageLabel>OUT OF SCOPE</StageLabel>
            <StageChips items={outOfScope} tone="coral" />
          </div>
        )}
      </>
    );
  }

  if (agentName === "technology_agent") {
    const stack = (details.stack as string[]) || [];
    const alternative = (details.alternative as string) || "";
    const learningCurve = (details.learning_curve as string) || "";
    const stackIsSuggested = missingInputs.includes("tech_stack");
    return (
      <>
        {stack.length > 0 && (
          <div>
            <StageLabel>{stackIsSuggested ? "AI-SUGGESTED STACK" : "RECOMMENDED STACK"}</StageLabel>
            <StageChips items={stack} tone="mint" />
          </div>
        )}
        {learningCurve && (
          <div>
            <StageLabel>LEARNING CURVE</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{learningCurve}</p>
          </div>
        )}
        {alternative && (
          <div>
            <StageLabel>LOW-RESOURCE ALTERNATIVE</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{alternative}</p>
          </div>
        )}
      </>
    );
  }

  if (agentName === "timeline_agent") {
    const totalDuration = (details.total_duration as string) || "";
    const weeks = (details.weeks as string[]) || [];
    const milestones = (details.milestones as string[]) || [];
    const timelineIsSuggested = missingInputs.includes("duration");
    return (
      <>
        {totalDuration && (
          <div>
            <StageLabel>{timelineIsSuggested ? "AI-ASSUMED DURATION" : "PLANNED FOR"}</StageLabel>
            <p className="text-[11px] text-ink-500">{totalDuration}</p>
          </div>
        )}
        {weeks.length > 0 && (
          <div>
            <StageLabel>{timelineIsSuggested ? "AI-SUGGESTED WEEK-BY-WEEK" : "WEEK-BY-WEEK"}</StageLabel>
            <ul className="text-[11px] text-ink-500 leading-relaxed list-disc pl-4 space-y-0.5">
              {weeks.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {milestones.length > 0 && (
          <div>
            <StageLabel>MILESTONE CHECKPOINTS</StageLabel>
            <StageChips items={milestones} tone="mint" />
          </div>
        )}
      </>
    );
  }

  if (agentName === "risk_agent") {
    const risks = (details.risks as Array<{
      category: string;
      description: string;
      likelihood: string;
      impact: string;
      source_agent: string;
      mitigation: string;
    }>) || [];
    
    return (
      <>
        {risks.length > 0 && (
          <div>
            <StageLabel>IDENTIFIED RISKS</StageLabel>
            <div className="flex flex-col gap-2 mt-1">
              {risks.map((risk, idx) => (
                <div key={idx} className="bg-canvas/50 border border-ink-100 rounded-lg p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink-600 bg-ink-100 px-1.5 py-0.5 rounded">{risk.category}</span>
                    <div className="flex gap-1.5 text-[9px] font-medium uppercase tracking-wider text-ink-400">
                      <span>L: {risk.likelihood}</span>
                      <span>·</span>
                      <span>I: {risk.impact}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-600 leading-relaxed">{risk.description}</p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-primary-500 uppercase">Mitigation ({risk.source_agent})</span>
                    <p className="text-[11px] text-ink-500 italic leading-relaxed">{risk.mitigation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  if (agentName === "novelty_agent") {
    const closestMatches = (details.closest_matches as Array<{
      title: string;
      overlap_description: string;
      similarity: string;
    }>) || [];
    const suggestions = (details.differentiation_suggestions as string[]) || [];
    const uniqueAngle = (details.unique_angle as string) || "";
    return (
      <>
        {uniqueAngle && (
          <div>
            <StageLabel>YOUR DEFENSIBLE ANGLE</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed italic">{uniqueAngle}</p>
          </div>
        )}
        {closestMatches.length > 0 && (
          <div>
            <StageLabel>CLOSEST MATCHES</StageLabel>
            <div className="flex flex-col gap-2 mt-1">
              {closestMatches.map((match, idx) => (
                <div key={idx} className="bg-canvas/50 border border-ink-100 rounded-lg p-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-ink-600">{match.title}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                      {match.similarity} overlap
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 leading-relaxed">{match.overlap_description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {suggestions.length > 0 && (
          <div>
            <StageLabel>WAYS TO DIFFERENTIATE</StageLabel>
            <ul className="text-[11px] text-ink-500 leading-relaxed list-disc pl-4 space-y-0.5">
              {suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  if (agentName === "skill_development_agent") {
    const learningPath = (details.learning_path as Array<{
      skill: string;
      blocks_feature: string;
      priority: string;
      suggested_approach: string;
      estimated_hours: string;
    }>) || [];
    const sequencingNote = (details.sequencing_note as string) || "";
    return (
      <>
        {learningPath.length > 0 && (
          <div>
            <StageLabel>LEARNING PATH</StageLabel>
            <div className="flex flex-col gap-2 mt-1">
              {learningPath.map((item, idx) => (
                <div key={idx} className="bg-canvas/50 border border-ink-100 rounded-lg p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-ink-600">{item.skill}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-[10px] text-ink-400">For: {item.blocks_feature}</p>
                  <p className="text-[11px] text-ink-500 leading-relaxed">{item.suggested_approach}</p>
                  <p className="text-[10px] text-ink-400">~{item.estimated_hours}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {sequencingNote && (
          <div>
            <StageLabel>SEQUENCING</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{sequencingNote}</p>
          </div>
        )}
      </>
    );
  }

  if (agentName === "team_momentum_agent") {
    const breakdown = (details.contribution_breakdown as Array<{
      contributor: string;
      commit_share_percent: number;
      note: string;
    }>) || [];
    const timingPattern = (details.timing_pattern as string) || "";
    const checkinAlignment = (details.checkin_alignment as string) || "";
    return (
      <>
        {breakdown.length > 0 && (
          <div>
            <StageLabel>CONTRIBUTION BREAKDOWN</StageLabel>
            <div className="flex flex-col gap-1.5 mt-1">
              {breakdown.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-600 font-medium w-24 shrink-0 truncate">
                    {item.contributor}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-canvas-alt overflow-hidden">
                    <div
                      className="h-full bg-primary-400"
                      style={{ width: `${item.commit_share_percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-ink-400 w-8 shrink-0 text-right">
                    {item.commit_share_percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {timingPattern && (
          <div>
            <StageLabel>TIMING PATTERN</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{timingPattern}</p>
          </div>
        )}
        {checkinAlignment && (
          <div>
            <StageLabel>CHECK-IN ALIGNMENT</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{checkinAlignment}</p>
          </div>
        )}
      </>
    );
  }

  if (agentName === "viva_agent") {
    const panel = (details.panel as Array<{
      persona: string;
      question: string;
      why_they_ask_this: string;
      model_answer: string;
      answer_confidence: string;
    }>) || [];
    const weakestPoint = (details.weakest_point_to_prepare as string) || "";
    return (
      <>
        {panel.length > 0 && (
          <div>
            <StageLabel>PANEL QUESTIONS</StageLabel>
            <div className="flex flex-col gap-2 mt-1">
              {panel.map((q, idx) => (
                <div key={idx} className="bg-canvas/50 border border-ink-100 rounded-lg p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink-600 bg-ink-100 px-1.5 py-0.5 rounded">
                      {q.persona}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
                      {q.answer_confidence}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-600 leading-relaxed font-medium">{q.question}</p>
                  <p className="text-[10px] text-ink-400 italic">{q.why_they_ask_this}</p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-primary-500 uppercase">Model answer</span>
                    <p className="text-[11px] text-ink-500 italic leading-relaxed">{q.model_answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {weakestPoint && (
          <div>
            <StageLabel>WEAKEST POINT TO PREPARE</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{weakestPoint}</p>
          </div>
        )}
      </>
    );
  }

  if (agentName === "calibration_agent") {
    const agentCalibration = (details.agent_calibration as Array<{
      agent_name: string;
      original_verdict: string;
      original_confidence: number;
      held_up: string;
      evidence: string;
    }>) || [];
    const mostReliable = (details.most_reliable_agent as string) || "";
    const recommendation = (details.recommendation as string) || "";
    return (
      <>
        {agentCalibration.length > 0 && (
          <div>
            <StageLabel>AGENT-BY-AGENT AUDIT</StageLabel>
            <div className="flex flex-col gap-2 mt-1">
              {agentCalibration.map((item, idx) => (
                <div key={idx} className="bg-canvas/50 border border-ink-100 rounded-lg p-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-ink-600">
                      {AGENT_META[item.agent_name as AgentName]?.label ?? item.agent_name}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        item.held_up === "Confirmed"
                          ? "bg-mint-100 text-mint-600"
                          : item.held_up === "Contradicted"
                          ? "bg-coral-100 text-coral-600"
                          : "bg-canvas-alt text-ink-400"
                      )}
                    >
                      {item.held_up}
                    </span>
                  </div>
                  <p className="text-[10px] text-ink-400">
                    Said: {item.original_verdict} ({item.original_confidence}%)
                  </p>
                  <p className="text-[11px] text-ink-500 leading-relaxed">{item.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {mostReliable && (
          <div>
            <StageLabel>MOST RELIABLE AGENT SO FAR</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{mostReliable}</p>
          </div>
        )}
        {recommendation && (
          <div>
            <StageLabel>RECOMMENDATION</StageLabel>
            <p className="text-[11px] text-ink-500 leading-relaxed">{recommendation}</p>
          </div>
        )}
      </>
    );
  }

  return null;
}

/**
 * Team Momentum is the only agent that isn't automatic — there's no live
 * repo integration, so commit activity has to be pasted in (or skipped
 * entirely, which is a valid input: the agent returns "Insufficient Data").
 */
function TeamMomentumInputForm({
  isAnalyzing,
  onSubmit,
}: {
  isAnalyzing: boolean;
  onSubmit: (commitData: TeamMomentumIn) => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [commitLog, setCommitLog] = useState("");

  // Expects lines like: "alice | 2024-05-01T10:00:00Z | fix: navbar bug"
  // (close to `git log --pretty=format:"%an | %aI | %s"`), one commit per line.
  function parseCommitLog(raw: string): TeamMomentumIn["commits"] {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [contributor, timestamp, ...rest] = line.split("|").map((p) => p.trim());
        return {
          contributor: contributor || "unknown",
          timestamp: timestamp || new Date().toISOString(),
          message: rest.join("|").trim() || "",
        };
      });
  }

  return (
    <div className="gradient-ring rounded-xl bg-canvas-alt/60 p-5 flex flex-col gap-3">
      <StageLabel>TEAM MOMENTUM — COMMIT ACTIVITY (OPTIONAL)</StageLabel>
      <p className="text-[11px] text-ink-500 leading-relaxed">
        No repository is connected automatically. Paste commit lines as{" "}
        <code className="text-[10px] bg-canvas px-1 py-0.5 rounded">
          contributor | timestamp | message
        </code>
        , one per line, or leave blank to run with no data.
      </p>
      <input
        type="text"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        placeholder="Repo URL (optional)"
        className="text-[11px] rounded-lg border border-ink-100 bg-canvas px-3 py-2 text-ink-700 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
      />
      <textarea
        value={commitLog}
        onChange={(e) => setCommitLog(e.target.value)}
        placeholder={"alice | 2024-05-01T10:00:00Z | fix: navbar bug\nbob | 2024-05-02T14:30:00Z | feat: add login form"}
        rows={4}
        className="text-[11px] rounded-lg border border-ink-100 bg-canvas px-3 py-2 text-ink-700 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-primary-200 font-mono"
      />
      <button
        type="button"
        disabled={isAnalyzing}
        onClick={() =>
          onSubmit({
            repo_url: repoUrl.trim() || null,
            commits: parseCommitLog(commitLog),
          })
        }
        className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg py-3 border-2 border-dashed border-primary-200 hover:border-primary-300 disabled:opacity-50 transition-colors"
      >
        {isAnalyzing ? (
          <>
            <Loader2 size={14} className="animate-spin" /> {AGENT_META.team_momentum_agent.loadingLabel}
          </>
        ) : (
          <>
            {(() => {
              const Icon = AGENT_META.team_momentum_agent.icon;
              return <Icon size={14} />;
            })()}
            {AGENT_META.team_momentum_agent.actionLabel}
          </>
        )}
      </button>
    </div>
  );
}

function StageCard({
  agentName,
  feedback,
  isAnalyzing,
  onRerun,
}: {
  agentName: AgentName;
  feedback: AgentFeedback;
  isAnalyzing: boolean;
  onRerun: () => void;
}) {
  const meta = AGENT_META[agentName];
  const Icon = meta.icon;
  const missingInputs = (feedback.details?.missing_inputs as string[] | undefined) || [];

  return (
    <div className="gradient-ring rounded-xl bg-canvas-alt/60 p-5 flex flex-col gap-4 transition-shadow hover:shadow-[0_8px_24px_-8px_rgba(109,63,251,0.18)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
            {meta.label} Analysis
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border w-fit",
              verdictClassName(feedback.verdict)
            )}
          >
            <Icon size={11} /> {feedback.verdict}
            {feedback.confidence_score != null && (
              <span className="opacity-70">· {feedback.confidence_score}%</span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={onRerun}
          disabled={isAnalyzing}
          title={`Re-run ${meta.label}`}
          className="text-ink-300 hover:text-primary-600 disabled:opacity-50 shrink-0 transition-transform hover:rotate-90 duration-300"
        >
          {isAnalyzing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
      </div>

      <MissingInputsCallout fields={missingInputs} />

      {feedback.reasoning && (
        <p className="text-[11px] text-ink-500 leading-relaxed">{feedback.reasoning}</p>
      )}

      <AgentDetails agentName={agentName} details={feedback.details} missingInputs={missingInputs} />

      {feedback.skill_gaps && feedback.skill_gaps.length > 0 && (
        <div>
          <StageLabel>SKILL GAPS</StageLabel>
          <StageChips items={feedback.skill_gaps} tone="coral" />
        </div>
      )}

      {feedback.suggested_adjustments && (
        <div>
          <StageLabel>SUGGESTED</StageLabel>
          <p className="text-[11px] text-ink-500 leading-relaxed">
            {feedback.suggested_adjustments}
          </p>
        </div>
      )}
    </div>
  );
}

export function AgentChainPanel({
  feedback,
  isExpanded,
  isKeyAnalyzing,
  onToggleExpand,
  onRunAgent,
  onRunTeamMomentum,
}: AgentChainPanelProps) {
  const feasibility = feedback.feasibility_agent;

  // Not started yet — same top-level CTA as before, just for the first
  // agent in the chain.
  if (!feasibility) {
    const meta = AGENT_META.feasibility_agent;
    const analyzing = isKeyAnalyzing("feasibility_agent");
    return (
      <button
        type="button"
        disabled={analyzing}
        onClick={() => onRunAgent("feasibility_agent")}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {analyzing ? (
          <>
            <Loader2 size={13} className="animate-spin" /> {meta.loadingLabel}
          </>
        ) : (
          <>
            <Sparkles size={13} /> {meta.actionLabel}
          </>
        )}
      </button>
    );
  }

  // Find the first agent in the chain that hasn't been run yet — that's
  // the only "next step" action we offer, since the backend requires the
  // chain to be run in order.
  const nextAgent = AGENT_ORDER.find((agentName) => !feedback[agentName]);

  return (
    <div>
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between gap-2"
      >
        <span
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border",
            verdictClassName(feasibility.verdict)
          )}
        >
          <Sparkles size={11} /> {feasibility.verdict}
          {feasibility.confidence_score != null && (
            <span className="opacity-70">· {feasibility.confidence_score}%</span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={cn("text-ink-300 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-ink-900/40 backdrop-blur-sm" 
            onClick={onToggleExpand}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-primary-50 bg-canvas/50 shrink-0">
                <h2 className="font-display font-semibold text-ink-900">Agent Analysis Chain</h2>
                <button onClick={onToggleExpand} className="p-2 text-ink-400 hover:text-ink-600 rounded-full hover:bg-canvas-alt transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-canvas">
                <div className="flex flex-col gap-6">
                  {AGENT_ORDER.map((agentName) => {
                    const stageFeedback = feedback[agentName];
                    if (!stageFeedback) return null;
                    return (
                      <StageCard
                        key={agentName}
                        agentName={agentName}
                        feedback={stageFeedback}
                        isAnalyzing={isKeyAnalyzing(agentName)}
                        onRerun={() => onRunAgent(agentName)}
                      />
                    );
                  })}

                  {nextAgent && AGENT_NEEDS_INPUT_FORM[nextAgent] && (
                    <TeamMomentumInputForm
                      isAnalyzing={isKeyAnalyzing(nextAgent)}
                      onSubmit={onRunTeamMomentum}
                    />
                  )}

                  {nextAgent && !AGENT_NEEDS_INPUT_FORM[nextAgent] && (
                    <button
                      type="button"
                      onClick={() => onRunAgent(nextAgent)}
                      disabled={isKeyAnalyzing(nextAgent)}
                      className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg py-4 border-2 border-dashed border-primary-200 hover:border-primary-300 disabled:opacity-50 transition-colors h-full min-h-[120px]"
                    >
                      {isKeyAnalyzing(nextAgent) ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          <span>{AGENT_META[nextAgent].loadingLabel}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          {(() => {
                            const Icon = AGENT_META[nextAgent].icon;
                            return <Icon size={20} />;
                          })()}
                          <span>{AGENT_META[nextAgent].actionLabel}</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
