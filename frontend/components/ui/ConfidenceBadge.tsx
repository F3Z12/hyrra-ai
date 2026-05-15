interface ConfidenceBadgeProps {
  confidence: number;
  needsReview: boolean;
}

export function ConfidenceBadge({ confidence, needsReview }: ConfidenceBadgeProps) {
  const isGreen = confidence >= 80 && !needsReview;
  const isRed = confidence < 50;
  const color = isGreen
    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    : isRed
    ? "text-red-400 bg-red-400/10 border-red-400/20"
    : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  const label = needsReview ? `${confidence}% · Review` : `${confidence}%`;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}
