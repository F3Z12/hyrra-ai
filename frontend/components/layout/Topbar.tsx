"use client";
import { Search } from "lucide-react";

interface TopbarProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Topbar({ title, subtitle, action }: TopbarProps) {
  return (
    <header className="fixed top-0 left-[264px] right-0 bg-[#08090d]/95 backdrop-blur z-40">
      <div className="h-full flex items-center justify-between max-w-[1280px] mx-auto hyrra-topbar">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-[320px] hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-dark pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search jobs, resumes..." 
            className="w-full rounded-2xl border border-white/5 bg-[#15161c] pr-14 text-sm text-foreground outline-none focus:border-white/20 transition-colors hyrra-search-input"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/5 text-muted-dark text-[10px] px-2 py-1 rounded font-mono font-medium border border-white/5 pointer-events-none">
            ⌘K
          </kbd>
        </div>
        {action}
      </div>
      </div>
    </header>
  );
}
