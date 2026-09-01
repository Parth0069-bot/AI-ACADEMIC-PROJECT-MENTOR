"use client";

/**
 * Faculty registration -- isolated from the student flow at
 * /register. Faculty pick a domain (see FACULTY_DOMAINS below); 'CSE'
 * is the one value with special meaning -- it grants global project
 * visibility under the RLS policies in supabase/migration.sql
 * (public.current_faculty_domain()).
 *
 * Reliability note: role/domain metadata is passed through
 * `options.data` on signUp (lands in auth.users.raw_user_meta_data),
 * and the row that actually drives access -- the `faculty` table --
 * is written by this frontend callback immediately after signUp
 * succeeds, the same pattern /register already uses for `student`.
 * There is no "profiles" / "faculty_domains" split in this schema:
 * `faculty` already carries the domain column and is what every RLS
 * policy (current_faculty_domain(), the project_ideas/student/
 * agent_feedback policies) reads from. Introducing parallel tables
 * here would fork that source of truth without anything to keep them
 * in sync, so faculty identity + domain both live in one place.
 */

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import { User, Mail, Lock, ShieldCheck, Building2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FloatingMascot } from "@/components/illustrations/FloatingMascot";
import { supabase } from "@/lib/supabaseClient";

const FACULTY_DOMAINS = [
  "CSE",
  "AI-ML",
  "Web Development",
  "Cybersecurity",
  "IoT",
  "Cloud Computing",
  "Data Science",
  "Electronics",
  "Other",
];

export default function FacultyRegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!domain) {
      toast.error("Please select your domain");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: "faculty",
          domain,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      toast.error(
        "Check your inbox to confirm your email, or turn off 'Confirm email' in Supabase Auth settings for development."
      );
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("faculty").insert({
      supabase_user_id: data.user!.id,
      name,
      email,
      domain,
    });

    if (insertError) {
      toast.error(
        "Account created, but saving your faculty profile failed: " + insertError.message
      );
      setLoading(false);
      return;
    }

    notify.success(`Welcome, ${name.split(" ")[0]}! 🎓`);
    router.push("/faculty");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-4xl grid md:grid-cols-2 rounded-3xl bg-surface shadow-[0_8px_40px_rgba(109,63,251,0.10)] overflow-hidden"
      >
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <ShieldCheck size={20} />
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold text-sm text-ink-900">AI Academic</p>
              <p className="font-display text-[11px] text-ink-400 -mt-0.5">Faculty Command Center</p>
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold text-ink-900">
            Register as faculty 🎓
          </h1>
          <p className="text-sm text-ink-400 mt-1 mb-6">
            Create your faculty account to monitor and mentor your cohort
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="name"
              label="Full Name"
              placeholder="Dr. Jane Smith"
              icon={<User size={16} />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              id="email"
              type="email"
              label="Email Address"
              placeholder="you@university.edu"
              icon={<Mail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="••••••••"
                icon={<Lock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Input
                id="confirm-password"
                type="password"
                label="Confirm Password"
                placeholder="••••••••"
                icon={<Lock size={16} />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="domain" className="text-sm font-medium text-ink-700">
                Domain
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300">
                  <Building2 size={16} />
                </span>
                <select
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  required
                  className="w-full appearance-none rounded-xl border border-primary-100 bg-surface py-2.5 pl-10 pr-3.5 text-sm text-ink-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    Select your domain
                  </option>
                  {FACULTY_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-ink-300">
                CSE faculty see every project; other domains see only their own.
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? "Creating account..." : "Create Faculty Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-400 mt-6">
            Already have a faculty account?{" "}
            <Link href="/login/faculty" className="text-primary-600 font-medium hover:underline">
              Login
            </Link>
          </p>
          <p className="text-center text-xs text-ink-300 mt-2">
            Not faculty?{" "}
            <Link href="/register" className="text-primary-600 hover:underline">
              Student registration
            </Link>
          </p>
        </div>

        <div className="hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-10 relative overflow-hidden">
          <motion.div
            className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute bottom-10 left-0 h-24 w-24 rounded-full bg-white/10" />
          <FloatingMascot pose="graduate" className="w-48 relative z-10" />
          <p className="font-display text-white text-lg font-semibold mt-6 text-center relative z-10">
            Guide your cohort
            <br />
            with live project signals
          </p>
        </div>
      </motion.div>
    </div>
  );
}
