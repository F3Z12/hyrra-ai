"use client";
import { Search } from "lucide-react";

interface TopbarProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Topbar({ title, subtitle, action }: TopbarProps) {
  return (
    <header className="fixed top-0 left-0 md:left-[264px] right-0 bg-[#08090d]/95 backdrop-blur z-40">
      <div className="h-full flex items-center justify-between max-w-[1280px] mx-auto hyrra-topbar">
        <div className="min-w-0 pr-4">
          <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hyrra-search-wrap hidden md:block">
            <Search className="hyrra-search-icon" />
            <input
              type="text"
              placeholder="Search jobs, resumes..."
              className="hyrra-search-input"
            />
            <kbd className="hyrra-search-shortcut">Cmd K</kbd>
          </div>
          {action}
        </div>
      </div>
    </header>
  );
}
