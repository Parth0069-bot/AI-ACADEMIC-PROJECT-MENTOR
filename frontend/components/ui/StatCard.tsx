import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

const TONES = {
  primary: "bg-primary-50 text-primary-700",
  mint: "bg-mint-100 text-mint-500",
  amber: "bg-amber-100 text-amber-500",
  sky: "bg-sky-100 text-sky-500",
} as const;

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  sublabel: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-2xl bg-white border border-primary-100/60 p-5 flex-1 min-w-[140px]">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-3", TONES[tone])}>
        <Icon size={18} />
      </div>
      <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
      <p className="text-[11px] text-ink-300 mt-1">{sublabel}</p>
    </div>
  );
}
