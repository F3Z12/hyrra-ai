"use client";
import { cn } from "@/lib/utils";

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function GradientButton({ variant = "primary", size = "md", className, children, ...props }: GradientButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap leading-none";
  const sizes = { sm: "h-10 px-4 text-xs", md: "h-11 px-6 text-sm", lg: "h-12 px-7 text-base" };
  const variants = {
    primary: "bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/40 hover:brightness-110",
    secondary: "bg-panel border border-border text-foreground hover:bg-panel-hover hover:border-border-hover",
    ghost: "text-muted hover:text-foreground hover:bg-white/5",
    danger: "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20",
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
