"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Lightbulb,
  FileText,
  Code2,
  ArrowRight,
  Target,
  Layers,
  Gauge,
  Clock,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types";

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Easy: "border-mint-500 bg-mint-100 text-mint-500",
  Medium: "border-amber-500 bg-amber-100 text-amber-500",
  Hard: "border-coral-500 bg-coral-100 text-coral-500",
};

export default function SubmitIdeaPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");
  const [domain, setDomain] = useState("");
  const [objectives, setObjectives] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [duration, setDuration] = useState("");
  const [teamSize, setTeamSize] = useState("1");
  const [status, setStatus] = useState("Pending");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!profile) {
      toast.error("You need to be logged in to submit an idea.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in the project title and description.");
      return;
    }

    const teamSizeNum = parseInt(teamSize, 10);
    if (!teamSizeNum || teamSizeNum < 1) {
      toast.error("Team size must be at least 1.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("project_ideas").insert({
      student_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      tech_stack: techStack.trim() || null,
      domain: domain.trim() || null,
      objectives: objectives.trim() || null,
      difficulty,
      duration: duration.trim() || null,
      team_size: teamSizeNum,
      status,
    });

    setSubmitting(false);

    if (error) {
      toast.error("Couldn't submit your idea: " + error.message);
      return;
    }

    toast.success("Idea submitted! 🚀");
    setTitle("");
    setDescription("");
    setTechStack("");
    setDomain("");
    setObjectives("");
    setDifficulty("Easy");
    setDuration("");
    setTeamSize("1");
    setStatus("Pending");
    router.push("/projects");
  }

  return (
    <>
      <div className="flex items-center gap-3 px-6 md:px-10 pt-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 shrink-0">
          <Lightbulb size={22} />
        </div>
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-ink-900">
            Submit a Project Idea
          </h1>
          <p className="text-sm text-ink-400 mt-0.5">
            Have a brilliant idea? Submit it here for review and mentorship!
          </p>
        </div>
      </div>

      <div className="px-6 md:px-10 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-3xl">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <Input
                id="title"
                label="Project Title"
                placeholder="E.g., AI-Powered Study Assistant"
                icon={<Lightbulb size={16} />}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <Textarea
                id="description"
                label="Project Description"
                placeholder="Describe what the project does, the problem it solves, and who it is for..."
                icon={<FileText size={16} />}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <div className="grid sm:grid-cols-2 gap-6">
                <Input
                  id="domain"
                  label="Domain"
                  placeholder="E.g., Artificial Intelligence, Web Dev"
                  icon={<Layers size={16} />}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
                <Input
                  id="tech-stack"
                  label="Proposed Tech Stack (Optional)"
                  placeholder="E.g., Next.js, Python, Supabase"
                  icon={<Code2 size={16} />}
                  value={techStack}
                  onChange={(e) => setTechStack(e.target.value)}
                />
              </div>

              <Textarea
                id="objectives"
                label="Objectives"
                placeholder="What are the key goals this project aims to achieve?"
                icon={<Target size={16} />}
                rows={3}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
              />

              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">
                  Difficulty
                </label>
                <div className="flex gap-3">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2",
                        difficulty === d
                          ? DIFFICULTY_STYLE[d]
                          : "border-primary-100 bg-white text-ink-400 hover:border-primary-300"
                      )}
                    >
                      <Gauge size={14} /> {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <Input
                  id="duration"
                  label="Estimated Duration"
                  placeholder="E.g., 1 Month, 6 Weeks"
                  icon={<Clock size={16} />}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
                <Input
                  id="team-size"
                  type="number"
                  min={1}
                  label="Team Size"
                  placeholder="1"
                  icon={<Users size={16} />}
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-primary-100 bg-white py-2.5 px-3.5 text-sm text-ink-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="Pending">Pending</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                </select>
                <p className="text-xs text-ink-300 mt-1.5">
                  Approval status is normally set by a mentor after review — this defaults
                  to Pending.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Idea"}
                  {!submitting && <ArrowRight size={15} />}
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
