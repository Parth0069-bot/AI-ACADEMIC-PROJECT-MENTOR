"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Mail, Lock, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FloatingMascot } from "@/components/illustrations/FloatingMascot";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      toast.success("Welcome back!");
      router.push("/dashboard");
      return;
    }

    const { data: exists } = await supabase.rpc("check_student_email_exists", {
      p_email: email,
    });

    if (!exists) {
      toast.error("No account found with this email. Let's create one!");
      setRedirecting(true);
      setTimeout(() => {
        router.push(`/register?email=${encodeURIComponent(email)}`);
      }, 1400);
      return;
    }

    toast.error("Incorrect password. Please try again.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-4xl grid md:grid-cols-2 rounded-3xl bg-white shadow-[0_8px_40px_rgba(109,63,251,0.10)] overflow-hidden"
      >
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <GraduationCap size={20} />
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold text-sm text-ink-900">AI Academic</p>
              <p className="font-display text-[11px] text-ink-400 -mt-0.5">Project Mentor</p>
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold text-ink-900">Welcome back 👋</h1>
          <p className="text-sm text-ink-400 mt-1 mb-6">
            Login to continue your learning journey
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-500">
                <input type="checkbox" className="rounded border-primary-200 text-primary-600 focus:ring-primary-300" />
                Remember me
              </label>
              <Link href="#" className="text-primary-600 font-medium hover:underline">
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {redirecting ? "Redirecting to sign up..." : loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-400 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary-600 font-medium hover:underline">
              Register
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
            Your ideas. Our AI.
            <br />
            Epic projects!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
