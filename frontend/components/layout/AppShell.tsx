"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

// Routes under /apply-demo render without the Hyrra dashboard shell so they
// look like standalone external pages (the OpenClaw browser automation target).
const STANDALONE_PREFIXES = ["/apply-demo"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = STANDALONE_PREFIXES.some((p) => pathname.startsWith(p));

  if (isStandalone) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="hyrra-shell-main">
        <div className="min-h-screen">
          <main className="hyrra-page-inner hyrra-page">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
