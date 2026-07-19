"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { User, Mail, Lock, GraduationCap, Building2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FloatingMascot } from "@/components/illustrations/FloatingMascot";
import { supabase } from "@/lib/supabaseClient";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prefill = params.get("email");
    if (prefill) setEmail(prefill);
  }, [params]);

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

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });

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

    const { error: insertError } = await supabase.from("student").insert({
      supabase_user_id: data.user!.id,
      name,
      email,
      department,
    });

    if (insertError) {
      toast.error("Account created, but saving your profile failed: " + insertError.message);
      setLoading(false);
      return;
    }

    toast.success(`Welcome, ${name.split(" ")[0]}! 🎉`);
    router.push("/dashboard");
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

          <h1 className="font-display text-2xl font-bold text-ink-900">
            Create your account 👋
          </h1>
          <p className="text-sm text-ink-400 mt-1 mb-6">
            Start your journey with AI Academic Project Mentor
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="name"
              label="Full Name"
              placeholder="Enter your full name"
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
            <Input
              id="department"
              label="Department"
              placeholder="Computer Science Engineering"
              icon={<Building2 size={16} />}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-400 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-600 font-medium hover:underline">
              Login
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
          <FloatingMascot pose="wave" className="w-48 relative z-10" />
          <p className="font-display text-white text-lg font-semibold mt-6 text-center relative z-10">
            Let&apos;s build something
            <br />
            amazing together!
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
