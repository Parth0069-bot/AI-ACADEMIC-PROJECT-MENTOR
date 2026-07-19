import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary-100/60 bg-white p-6 shadow-[0_2px_16px_rgba(109,63,251,0.05)]",
        className
      )}
      {...props}
    />
  );
}
