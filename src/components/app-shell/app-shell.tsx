"use client";

import { Topbar } from "@/components/app-shell/topbar";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar />
      <main className="flex-1 pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}
