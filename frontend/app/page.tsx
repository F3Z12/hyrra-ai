"use client";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { GradientButton } from "@/components/ui/GradientButton";
import { Briefcase, BarChart3, Send, MessageSquare, ArrowRight } from "lucide-react";
import { listJobs, listApplications, listMatches } from "@/lib/api";
import { timeAgo, initials } from "@/lib/utils";
import type { Job, Application, MatchResult } from "@/types/api";
import Link from "next/link";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([listJobs(), listApplications(), listMatches()])
      .then(([j, a, m]) => {
        if (j.status === "fulfilled") setJobs(j.value.jobs);
        if (a.status === "fulfilled") setApps(a.value.applications);
        if (m.status === "fulfilled") setMatches(m.value.matches);
      })
      .finally(() => setLoading(false));
  }, []);

  const avgScore = matches.length ? Math.round(matches.reduce((s, m) => s + m.match_score, 0) / matches.length) : 0;
  const appliedThisWeek = apps.filter((a) => a.status === "applied" && a.date_applied).length;
  const interviewing = apps.filter((a) => a.status === "interviewing").length;

  const stats = [
    { label: "Saved Jobs", value: jobs.length, icon: Briefcase, color: "text-accent-violet" },
    { label: "Avg Match Score", value: avgScore || "—", icon: BarChart3, color: "text-accent-cyan" },
    { label: "Applied", value: appliedThisWeek, icon: Send, color: "text-success" },
    { label: "Interviews", value: interviewing, icon: MessageSquare, color: "text-warning" },
  ];

  const statusCounts: Record<string, number> = {};
  apps.forEach((a) => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="Welcome back — here's your job hunt at a glance."
        action={<Link href="/matches"><GradientButton><GitCompareArrows size={16} /> Run AI match</GradientButton></Link>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 text-muted">Loading…</div>
      ) : (
        <div className="hyrra-stack">
          {/* Stat cards */}
          <div className="hyrra-grid-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-wider text-muted font-bold">{s.label}</span>
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><s.icon size={14} className={s.color} /></div>
                </div>
                <div className="text-4xl font-bold tracking-tight leading-none">{s.value}</div>
              </Card>
            ))}
          </div>

          <div className="hyrra-grid-3-start">
            {/* Recent jobs */}
            <Card className="flex flex-col h-full hyrra-col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Recent Jobs</h3>
                <Link href="/jobs" className="text-xs text-accent-violet hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
              </div>
              {jobs.length === 0 ? (
                <EmptyState title="No jobs saved yet" description="Save your first job to get started." />
              ) : (
                <div className="hyrra-section-stack">
                  {jobs.slice(0, 4).map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-accent-violet/10 text-accent-violet flex items-center justify-center text-xs font-bold">{initials(job.company || "??")}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{job.title || "Untitled"}</div>
                        <div className="text-xs text-muted">{job.company} · {timeAgo(job.created_at)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Application status */}
            <Card className="flex flex-col h-full hyrra-col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Application Status</h3>
                <Link href="/applications" className="text-xs text-accent-violet hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
              </div>
              {apps.length === 0 ? (
                <EmptyState title="No applications yet" description="Start tracking your applications." />
              ) : (
                <div className="hyrra-section-stack">
                  {["saved", "applied", "interviewing", "offer", "rejected"].map((status) => (
                    <div key={status} className="flex items-center justify-between">
                      <StatusPill status={status} />
                      <span className="text-sm font-mono font-bold">{statusCounts[status] || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Recent matches */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Recent Matches</h3>
              <Link href="/matches" className="text-xs text-accent-violet hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
            </div>
            {matches.length === 0 ? (
              <EmptyState title="No matches yet" description="Run your first match to see results." />
            ) : (
              <div className="hyrra-grid-3">
                {matches.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex flex-col gap-3 p-4 rounded-xl border border-white/5 bg-panel/30 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between">
                      <MatchScoreBadge score={m.match_score} />
                      <span className="text-[10px] text-muted-dark">{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{m.job_title || "Job"}</div>
                      <div className="text-xs text-muted truncate mt-0.5">{m.job_company} · {m.resume_name}</div>
                    </div>
                    <div className="text-xs text-muted-dark border-t border-white/5 pt-3 mt-1">
                      {m.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function GitCompareArrows(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="5" cy="6" r="3"/><path d="M12 6h5a2 2 0 0 1 2 2v7"/><path d="m15 9-3-3 3-3"/><circle cx="19" cy="18" r="3"/><path d="M12 18H7a2 2 0 0 1-2-2V9"/><path d="m9 15 3 3-3 3"/></svg>;
}
