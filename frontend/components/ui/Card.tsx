import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false, ...props }: CardProps) {
  return (
    <div 
      className={cn(
        "bg-gradient-to-b from-[#16171d] to-[#101116] border border-white/5 rounded-2xl hyrra-card-padding",
        hover && "transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
