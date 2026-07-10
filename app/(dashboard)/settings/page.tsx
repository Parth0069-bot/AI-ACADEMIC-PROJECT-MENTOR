"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <Topbar title="Settings" subtitle="Manage your account and preferences" />

      <div className="px-6 md:px-10 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl flex flex-col gap-6"
        >
          <Card>
            <h3 className="font-display font-semibold text-ink-900 mb-4">Account</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between border-b border-primary-50 pb-3">
                <span className="text-ink-400">Name</span>
                <span className="font-medium text-ink-900">{profile?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Email</span>
                <span className="font-medium text-ink-900">{profile?.email ?? "—"}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-display font-semibold text-ink-900 mb-2">Session</h3>
            <p className="text-sm text-ink-400 mb-4">
              Log out of AI Academic Project Mentor on this device.
            </p>
            <Button
              variant="secondary"
              onClick={handleLogout}
              className="!bg-coral-100 !text-coral-500 hover:!bg-coral-100/70"
            >
              <LogOut size={14} /> Log Out
            </Button>
          </Card>

          <Card className="bg-canvas-alt border-none">
            <p className="text-xs text-ink-400">
              More preferences (password change, notifications, theme) will be added in a
              later milestone.
            </p>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
