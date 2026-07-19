"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function InlineAlert({
  message,
  variant = "error",
}: {
  message: string | null;
  variant?: "error" | "success";
}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium",
              variant === "error" && "bg-coral-100 text-coral-500",
              variant === "success" && "bg-mint-100 text-mint-500"
            )}
          >
            {variant === "error" ? (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
