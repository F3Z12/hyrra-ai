import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 85) return "bg-success/15 text-success border-success/30";
  if (score >= 70) return "bg-accent-violet/15 text-accent-violet border-accent-violet/30";
  if (score >= 55) return "bg-warning/15 text-warning border-warning/30";
  return "bg-danger/15 text-danger border-danger/30";
}

function dotColor(score: number) {
  if (score >= 85) return "bg-success";
  if (score >= 70) return "bg-accent-violet";
  if (score >= 55) return "bg-warning";
  return "bg-danger";
}

export function MatchScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border font-mono", scoreColor(score), className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColor(score))} />
      {score}
    </span>
  );
}
