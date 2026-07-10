"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { StudentProfile } from "@/lib/types";

interface SignUpInput {
  name: string;
  email: string;
  password: string;
  department: string;
}

type SignInResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "wrong_password" | "unknown"; message: string };

type SignUpResult = { ok: true } | { ok: false; message: string };

interface AuthContextValue {
  user: User | null;
  profile: StudentProfile | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("student")
      .select("*")
      .eq("supabase_user_id", userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) await loadProfile(sessionUser.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        await loadProfile(sessionUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  async function signUp({ name, email, password, department }: SignUpInput): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        return { ok: false, message: "An account with this email already exists. Try logging in instead." };
      }
      return { ok: false, message: error.message };
    }

    const newUser = data.user;
    if (!newUser) {
      return { ok: false, message: "Something went wrong creating your account. Please try again." };
    }

    // Create the matching profile row. If email confirmation is on, there may be
    // no active session yet — insert still works because policy allows insert
    // where supabase_user_id = auth.uid(), and signUp() does authenticate the client.
    const { error: insertError } = await supabase.from("student").insert({
      supabase_user_id: newUser.id,
      name,
      email,
      department,
    });

    if (insertError) {
      return { ok: false, message: `Account created, but profile setup failed: ${insertError.message}` };
    }

    await loadProfile(newUser.id);
    return { ok: true };
  }

  async function signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) return { ok: true };

    // Supabase intentionally returns the same generic error for both a wrong
    // password and a non-existent account (this is a security best practice).
    // We disambiguate by asking a security-definer RPC whether the email exists at all.
    const { data: exists } = await supabase.rpc("email_exists", { check_email: email });

    if (exists === false) {
      return {
        ok: false,
        reason: "not_found",
        message: "No account found with this email.",
      };
    }

    return {
      ok: false,
      reason: "wrong_password",
      message: "Incorrect password. Please try again.",
    };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
