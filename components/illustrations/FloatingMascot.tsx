"use client";

import { motion } from "framer-motion";
import { Mascot } from "./Mascot";
import { cn } from "@/lib/utils";

const SPARKLES = [
  { top: "8%", left: "4%", size: 10, delay: 0 },
  { top: "18%", right: "0%", size: 7, delay: 0.6 },
  { top: "62%", left: "-4%", size: 8, delay: 1.1 },
  { top: "72%", right: "2%", size: 6, delay: 0.3 },
];

export function FloatingMascot({
  pose = "wave" as const,
  className,
}: {
  pose?: "wave" | "graduate" | "point";
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white/70"
          style={{
            top: s.top,
            left: "left" in s ? s.left : undefined,
            right: "right" in s ? s.right : undefined,
            width: s.size,
            height: s.size,
          }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            delay: s.delay,
            ease: "easeInOut",
          }}
        />
      ))}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Mascot pose={pose} />
      </motion.div>
    </div>
  );
}
