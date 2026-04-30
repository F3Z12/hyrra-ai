import { cn } from "@/lib/utils";

export function SkillTag({ skill, variant = "neutral" }: { skill: string; variant?: "matched" | "missing" | "neutral" }) {
  const styles = {
    matched: "bg-success/10 text-success border-success/25",
    missing: "bg-danger/10 text-danger border-danger/25",
    neutral: "bg-white/5 text-muted border-border",
  };
  return (
    <span className={cn("inline-block px-2.5 py-1 text-xs font-medium rounded-lg border", styles[variant])}>
      {skill}
    </span>
  );
}
