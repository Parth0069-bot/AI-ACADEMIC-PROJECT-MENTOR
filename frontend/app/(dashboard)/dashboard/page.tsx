"use client";

import { motion } from "framer-motion";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FloatingMascot } from "@/components/illustrations/FloatingMascot";
import { useAuth } from "@/context/AuthContext";
import {
  FolderKanban,
  CheckCircle2,
  ListChecks,
  Bot,
  ArrowRight,
  Plus,
  MessageCircle,
} from "lucide-react";

const MILESTONES = [
  { title: "Literature Review", due: "Due in 2 days" },
  { title: "System Architecture", due: "Due in 5 days" },
  { title: "Implementation Plan", due: "Due in 9 days" },
];

const QUICK_ACTIONS = [
  { label: "Add Project", icon: Plus, tone: "bg-coral-100 text-coral-500", href: "/projects" },
  { label: "Assess Skills", icon: ListChecks, tone: "bg-mint-100 text-mint-500", href: "/skills" },
  { label: "Chat with AI", icon: MessageCircle, tone: "bg-sky-100 text-sky-500", href: "/mentor" },
  { label: "View Progress", icon: ArrowRight, tone: "bg-primary-50 text-primary-700", href: "/progress" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const firstName = profile?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <Topbar title={`Hi ${firstName}! 👋`} subtitle="Ready to make today productive?" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="px-6 md:px-10 pb-10 flex flex-col gap-6"
      >
        <motion.div variants={item} className="flex flex-wrap gap-4">
          <StatCard label="Projects" sublabel="Active Projects" value={3} icon={FolderKanban} tone="primary" />
          <StatCard label="Milestones" sublabel="Completed" value={12} icon={CheckCircle2} tone="mint" />
          <StatCard label="Skills" sublabel="Skills Added" value={8} icon={ListChecks} tone="amber" />
          <StatCard label="AI Sessions" sublabel="Conversations" value={15} icon={Bot} tone="sky" />
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <motion.div variants={item}>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-ink-900">Your Progress</h3>
                  <span className="text-sm font-semibold text-primary-600">68%</span>
                </div>
                <p className="text-xs text-ink-400 mb-2">Overall Completion</p>
                <div className="h-2.5 rounded-full bg-canvas-alt overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary-600"
                    initial={{ width: 0 }}
                    animate={{ width: "68%" }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
                <p className="text-xs text-mint-500 font-medium mt-3">
                  You&apos;re doing great! Keep going 🎉
                </p>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-ink-900">Upcoming Milestones</h3>
                  <button className="text-xs font-semibold text-primary-600 flex items-center gap-1 hover:gap-2 transition-all">
                    View All <ArrowRight size={12} />
                  </button>
                </div>
                <div className="flex flex-col divide-y divide-primary-50">
                  {MILESTONES.map((m) => (
                    <div
                      key={m.title}
                      className="flex items-center justify-between py-3 rounded-lg hover:bg-primary-50/60 transition-colors px-2 -mx-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-primary-500" />
                        <span className="text-sm font-medium text-ink-700">{m.title}</span>
                      </div>
                      <span className="text-xs text-ink-400">{m.due}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <Card>
                <h3 className="font-display font-semibold text-ink-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {QUICK_ACTIONS.map((a) => (
                    <motion.a
                      key={a.label}
                      href={a.href}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.96 }}
                      className="flex flex-col items-center gap-2 rounded-xl border border-primary-100/60 py-4 hover:border-primary-300 hover:shadow-md transition-all"
                    >
                      <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${a.tone}`}>
                        <a.icon size={16} />
                      </span>
                      <span className="text-xs font-medium text-ink-700">{a.label}</span>
                    </motion.a>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={item}>
            <Card className="flex flex-col items-center text-center justify-between bg-gradient-to-b from-primary-50 to-white h-full">
              <div>
                <h3 className="font-display font-semibold text-ink-900 mb-4 self-start">AI Mentor Says</h3>
                <FloatingMascot pose="graduate" className="w-40 mx-auto" />
              </div>
              <p className="text-sm text-ink-500 italic mt-4">
                &quot;The best project you&apos;ll ever work on is the one you start today.&quot;
              </p>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
