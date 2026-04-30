import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  saved: "bg-muted-dark/20 text-muted border-muted-dark/30",
  applied: "bg-accent-violet/15 text-accent-violet border-accent-violet/30",
  interviewing: "bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30",
  offer: "bg-success/15 text-success border-success/30",
  rejected: "bg-danger/15 text-danger border-danger/30",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.saved;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border", style, className)}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        status === "saved" && "bg-muted-dark",
        status === "applied" && "bg-accent-violet",
        status === "interviewing" && "bg-accent-cyan",
        status === "offer" && "bg-success",
        status === "rejected" && "bg-danger",
      )} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
