import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
  > {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-primary-600 text-white shadow-sm shadow-primary-200 hover:bg-primary-700 active:scale-[0.98]",
          variant === "secondary" &&
            "bg-primary-50 text-primary-700 hover:bg-primary-100 active:scale-[0.98]",
          variant === "ghost" &&
            "text-ink-500 hover:bg-canvas-alt active:scale-[0.98]",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
