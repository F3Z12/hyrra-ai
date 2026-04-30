import { Inbox } from "lucide-react";

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 min-h-[220px] text-center">
      <div className="mb-4 text-muted-dark">{icon ?? <Inbox size={48} strokeWidth={1} />}</div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      {description && <p className="text-sm text-muted max-w-sm leading-relaxed">{description}</p>}
    </div>
  );
}
