import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef, ReactNode } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, icon, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-700">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && <span className="absolute left-3.5 top-3.5 text-ink-300">{icon}</span>}
          <textarea
            ref={ref}
            id={id}
            className={cn(
              "w-full rounded-xl border border-primary-100 bg-white py-3 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none",
              icon ? "pl-10 pr-3.5" : "px-3.5",
              error && "border-coral-500 focus:border-coral-500 focus:ring-coral-100",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-coral-500">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
