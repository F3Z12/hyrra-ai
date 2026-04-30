import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
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
