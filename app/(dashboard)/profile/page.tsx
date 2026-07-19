"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Pencil, Check, X } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const EDITABLE_FIELDS = [
  { key: "phone", label: "Phone Number", placeholder: "Add your phone number" },
  { key: "department", label: "Department", placeholder: "Add your department" },
  { key: "year_of_study", label: "Year of Study", placeholder: "e.g. 3rd Year" },
  { key: "university", label: "University", placeholder: "Add your university" },
] as const;

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    department: "",
    year_of_study: "",
    university: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        phone: profile.phone ?? "",
        department: profile.department ?? "",
        year_of_study: profile.year_of_study ?? "",
        university: profile.university ?? "",
      });
    }
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("student")
      .update(form)
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      toast.error("Couldn't save changes: " + error.message);
      return;
    }
    toast.success("Profile updated!");
    setEditing(false);
    refreshProfile();
  }

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <>
      <Topbar title="My Profile" subtitle="Manage your personal information" />

      <div className="px-6 md:px-10 pb-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-ink-900">Personal Information</h3>
              {!editing ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    <X size={14} /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Check size={14} /> {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex flex-col items-center gap-3 shrink-0">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center font-display text-2xl font-bold text-primary-700"
                >
                  {initials}
                </motion.div>
                <div className="text-center">
                  <p className="font-display font-semibold text-ink-900">
                    {profile?.name ?? "—"}
                  </p>
                  <p className="text-xs text-ink-400">{profile?.department || "Student"}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 flex-1 w-full">
                <div>
                  <p className="text-xs text-ink-400 mb-1">Full Name</p>
                  <p className="text-sm font-medium text-ink-900">{profile?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 mb-1">Email Address</p>
                  <p className="text-sm font-medium text-ink-900">{profile?.email ?? "—"}</p>
                </div>

                <AnimatePresence mode="wait">
                  {!editing ? (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="contents"
                    >
                      {EDITABLE_FIELDS.map((f) => (
                        <div key={f.key}>
                          <p className="text-xs text-ink-400 mb-1">{f.label}</p>
                          <p className="text-sm font-medium text-ink-900">
                            {profile?.[f.key] || (
                              <span className="text-ink-300 italic">Not added yet</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="contents"
                    >
                      {EDITABLE_FIELDS.map((f) => (
                        <Input
                          key={f.key}
                          label={f.label}
                          placeholder={f.placeholder}
                          value={form[f.key]}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                          }
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
