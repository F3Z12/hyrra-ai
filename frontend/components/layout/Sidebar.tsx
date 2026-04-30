"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, FileText, KanbanSquare, GitCompareArrows, Sparkles, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Resumes", href: "/resumes", icon: FileText },
  { label: "Applications", href: "/applications", icon: KanbanSquare },
  { label: "Matches", href: "/matches", icon: GitCompareArrows },
  { label: "AI Tools", href: "/ai-tools", icon: Sparkles },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();

  function isActive(href: string) {
    if (href === "/") return path === "/";
    return path.startsWith(href);
  }

  return (
    <aside className="hyrra-sidebar bg-panel flex flex-col z-30">
      {/* Brand */}
      <div className="hyrra-sidebar-brand gap-3.5">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-accent-violet to-accent-cyan flex items-center justify-center shadow-lg shadow-accent-violet/20">
          <Zap size={20} className="text-white" />
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-[15px] font-bold text-foreground tracking-tight leading-tight">Hyrra AI</div>
          <div className="text-[10px] text-muted-dark font-mono leading-none mt-1">v1.0 · beta</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-white/[0.04]"
              )}
            >
              <item.icon size={18} strokeWidth={active ? 2 : 1.5} />
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-violet shadow-[0_0_8px_rgba(139,92,246,0.8)]" />}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="pl-7 pr-6 pb-6 pt-6 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-accent-violet to-accent-cyan flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-accent-violet/20">U</div>
          <div className="flex flex-col justify-center">
            <div className="text-sm font-bold text-foreground leading-tight">User</div>
            <div className="text-xs text-muted-dark leading-none mt-1">Free plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
