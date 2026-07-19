"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FloatingMascot } from "@/components/illustrations/FloatingMascot";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Plus, Loader2 } from "lucide-react";
import type { FluencyLevel } from "@/lib/types";

interface Skill {
  tech_stack: string;
  fluency_level: FluencyLevel;
}

const LEVEL_META: Record<FluencyLevel, { pct: number; color: string }> = {
  beginner: { pct: 35, color: "bg-coral-500" },
  intermediate: { pct: 65, color: "bg-amber-500" },
  advanced: { pct: 90, color: "bg-mint-500" },
};

const DEFAULT_SKILLS: Skill[] = [
  { tech_stack: "Python", fluency_level: "beginner" },
  { tech_stack: "Web Development", fluency_level: "beginner" },
  { tech_stack: "Database (SQL)", fluency_level: "beginner" },
];

const TABS = ["Technical Skills", "Soft Skills", "Tools & Platforms"] as const;

export default function SkillsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Technical Skills");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSkills = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("skill_assessment")
      .select("tech_stack, fluency_level")
      .eq("student_id", profile.id);

    if (!error && data && data.length > 0) {
      setSkills(data as Skill[]);
    } else {
      setSkills(DEFAULT_SKILLS);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  function setLevel(name: string, level: FluencyLevel) {
    setSkills((prev) =>
      prev.map((s) => (s.tech_stack === name ? { ...s, fluency_level: level } : s))
    );
  }

  function addSkill() {
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.tech_stack.toLowerCase() === trimmed.toLowerCase())) {
      setNewSkill("");
      return;
    }
    setSkills((prev) => [...prev, { tech_stack: trimmed, fluency_level: "beginner" }]);
    setNewSkill("");
  }

  async function saveAssessment() {
    if (!profile) return;
    setSaving(true);

    const rows = skills.map((s) => ({
      student_id: profile.id,
      tech_stack: s.tech_stack,
      fluency_level: s.fluency_level,
    }));

    const { error } = await supabase
      .from("skill_assessment")
      .upsert(rows, { onConflict: "student_id,tech_stack" });

    setSaving(false);

    if (error) {
      toast.error("Couldn't save: " + error.message);
      return;
    }
    toast.success("Skills saved! 🎉");
  }

  return (
    <>
      <Topbar title="Skill Assessment" subtitle="Rate your skills and let AI help you grow" />

      <div className="px-6 md:px-10 pb-10 grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  tab === t
                    ? "bg-primary-600 text-white"
                    : "bg-canvas-alt text-ink-500 hover:bg-primary-50"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-ink-400 gap-2">
              <Loader2 size={18} className="animate-spin" /> Loading your skills...
            </div>
          ) : tab === "Technical Skills" ? (
            <div className="flex flex-col gap-5">
              {skills.map((skill, i) => {
                const meta = LEVEL_META[skill.fluency_level];
                return (
                  <motion.div
                    key={skill.tech_stack}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-ink-900">{skill.tech_stack}</span>
                      <div className="flex items-center gap-2">
                        {(["beginner", "intermediate", "advanced"] as FluencyLevel[]).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setLevel(skill.tech_stack, lvl)}
                            className={cn(
                              "text-[11px] px-2.5 py-1 rounded-full font-medium capitalize transition-colors",
                              skill.fluency_level === lvl
                                ? "bg-primary-100 text-primary-700"
                                : "text-ink-300 hover:text-ink-500"
                            )}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-canvas-alt overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", meta.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${meta.pct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </motion.div>
                );
              })}

              <div className="flex items-center gap-2 pt-2">
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  placeholder="Add a skill (e.g. React, DSA, Figma)"
                  className="flex-1 rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
                <Button type="button" variant="secondary" onClick={addSkill}>
                  <Plus size={14} /> Add Skill
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-ink-400">
              {tab} assessment is coming in a later milestone.
            </div>
          )}

          <div className="flex justify-end pt-6">
            <Button type="button" onClick={saveAssessment} disabled={saving || loading}>
              {saving ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col items-center text-center justify-center bg-gradient-to-b from-primary-50 to-white">
          <FloatingMascot pose="point" className="w-40" />
          <p className="font-display font-semibold text-ink-900 mt-4">Great skills! 🎉</p>
          <p className="text-sm text-ink-400 mt-1">
            Complete more projects to improve your skills and get more accurate AI feedback.
          </p>
        </Card>
      </div>
    </>
  );
}
