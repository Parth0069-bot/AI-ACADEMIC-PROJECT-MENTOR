import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Mascot } from "@/components/illustrations/Mascot";

export function ComingSoon({
  title,
  subtitle,
  note,
}: {
  title: string;
  subtitle: string;
  note: string;
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <div className="px-6 md:px-10 pb-10">
        <Card className="flex flex-col items-center text-center justify-center py-16 max-w-xl mx-auto">
          <Mascot pose="graduate" className="w-36" />
          <p className="font-display font-semibold text-ink-900 mt-4">Coming in a later milestone</p>
          <p className="text-sm text-ink-400 mt-1 max-w-sm">{note}</p>
        </Card>
      </div>
    </>
  );
}
