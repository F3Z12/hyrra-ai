import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply — Northstar EV Systems",
  description: "Hyrra Apply Agent demo application portal.",
};

export default function ApplyDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
