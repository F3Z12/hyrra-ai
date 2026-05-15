interface SourcePillProps {
  source: string;
}

const LABELS: Record<string, string> = {
  profile: "From profile",
  resume: "From resume",
  deterministic: "Extracted",
  ai: "AI-generated",
  none: "No suggestion",
};

const COLORS: Record<string, string> = {
  profile: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  resume: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  deterministic: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  ai: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  none: "text-zinc-400 bg-white/5 border-white/10",
};

export function SourcePill({ source }: SourcePillProps) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        COLORS[source] ?? COLORS.none
      }`}
    >
      {LABELS[source] ?? source}
    </span>
  );
}
