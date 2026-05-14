"use client";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" subtitle="Preferences and configuration" />

      <div className="max-w-2xl hyrra-page-stack">
        <Card>
          <h3 className="text-sm font-semibold mb-4">Profile</h3>
          <div className="hyrra-section-stack">
            <div>
              <label className="text-xs text-muted mb-1 block">Display name</label>
              <input type="text" defaultValue="User" className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Email</label>
              <input type="email" defaultValue="" placeholder="your@email.com" className="w-full" />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-4">AI Preferences</h3>
          <div className="hyrra-section-stack">
            {[
              { label: "Strict ATS mode", desc: "Optimize all AI outputs for ATS compatibility" },
              { label: "Conservative tone", desc: "Use more professional, conservative language" },
              { label: "Auto-match new jobs", desc: "Automatically run match when a new job is saved" },
            ].map((pref) => (
              <div key={pref.label} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{pref.label}</div>
                  <div className="text-xs text-muted">{pref.desc}</div>
                </div>
                <div className="w-10 h-5 bg-white/10 rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-muted-dark rounded-full absolute left-0.5 top-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-2">Plan</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Free plan</div>
              <div className="text-xs text-muted">Unlimited local usage · BYOK for AI features</div>
            </div>
            <span className="text-[10px] text-accent-violet bg-accent-violet/10 px-3 py-1 rounded-full border border-accent-violet/20 font-medium">ACTIVE</span>
          </div>
        </Card>
      </div>
    </>
  );
}
