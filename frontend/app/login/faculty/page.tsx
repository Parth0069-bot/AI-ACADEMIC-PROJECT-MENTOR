"use client";

/**
 * Faculty login -- isolated from the student flow at /login. Role
 * verification has no `role` column to check anywhere (there is no
 * unified "profiles" table in this schema -- see the note in
 * /register/faculty/page.tsx), so "is this account faculty" is
 * answered the same way the rest of this schema answers it: by
 * whether a row for this auth user exists in `faculty`. A successful
 * password sign-in that doesn't own a `faculty` row is signed back
 * out immediately -- that's the role check the task asks for, applied
 * to how this app actually models roles.
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import { Mail, Lock, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FloatingMascot } from "@/components/illustrations/FloatingMascot";
import { supabase } from "@/lib/supabaseClient";

export default function FacultyLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;

      const { data: facultyRow } = await supabase
        .from("faculty")
        .select("id")
        .eq("supabase_user_id", session.user.id)
        .maybeSingle();

      if (facultyRow) router.replace("/faculty");
      // A signed-in non-faculty session just sits on this page --
      // visiting the faculty login page shouldn't sign anyone out.
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const { data: exists } = await supabase.rpc("check_faculty_email_exists", {
        p_email: email,
      });

      if (!exists) {
        toast.error("No faculty account found with this email. Let's create one!");
        setRedirecting(true);
        setTimeout(() => {
          router.push(`/register/faculty?email=${encodeURIComponent(email)}`);
        }, 1400);
        return;
      }

      toast.error("Incorrect password. Please try again.");
      setLoading(false);
      return;
    }

    // Role check: a valid password doesn't mean a valid faculty
    // account -- a student could type their own credentials in here.
    const { data: facultyRow, error: facultyLookupError } = await supabase
      .from("faculty")
      .select("id")
      .eq("supabase_user_id", signInData.user.id)
      .maybeSingle();

    if (facultyLookupError || !facultyRow) {
      await supabase.auth.signOut();
      toast.error("This account isn't registered as faculty.");
      setLoading(false);
      return;
    }

    notify.success("Welcome back!");
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

          <h1 className="font-display text-2xl font-bold text-ink-900">Faculty login 👋</h1>
          <p className="text-sm text-ink-400 mt-1 mb-6">
            Sign in to review your cohort&apos;s projects
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {redirecting
                ? "Redirecting to sign up..."
                : loading
                ? "Logging in..."
                : "Login"}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-400 mt-6">
            Don&apos;t have a faculty account?{" "}
            <Link href="/register/faculty" className="text-primary-600 font-medium hover:underline">
              Register
            </Link>
          </p>
          <p className="text-center text-xs text-ink-300 mt-2">
            Not faculty?{" "}
            <Link href="/login" className="text-primary-600 hover:underline">
              Student login
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
          <FloatingMascot pose="point" className="w-48 relative z-10" />
          <p className="font-display text-white text-lg font-semibold mt-6 text-center relative z-10">
            Cohort intelligence,
            <br />
            one login away
          </p>
        </div>
      </motion.div>
    </div>
  );
}
