"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import { motion } from "framer-motion";

interface CardProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
  > {
  hoverLift?: boolean;
}

export function Card({ className, hoverLift = false, ...props }: CardProps) {
  return (
    <motion.div
      whileHover={hoverLift ? { y: -3, boxShadow: "0 8px 28px rgba(109,63,251,0.12)" } : undefined}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-2xl border border-primary-100/60 bg-white p-6 shadow-[0_2px_16px_rgba(109,63,251,0.05)]",
        className
      )}
      {...props}
    />
  );
}
