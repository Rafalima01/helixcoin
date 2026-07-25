"use client";

import { useState } from "react";
import { ShieldCheck, Monitor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { useManagerProfile } from "@/hooks/use-manager";
import { SecuritySection } from "@/components/profile/security-section";
import { SessionsSection } from "@/components/profile/sessions-section";
import { cn } from "@/lib/utils";

type TabKey = "seguranca" | "sessoes";

const TABS: { key: TabKey; label: string; icon: typeof ShieldCheck }[] = [
  { key: "seguranca", label: "Segurança", icon: ShieldCheck },
  { key: "sessoes", label: "Sessões", icon: Monitor },
];

export function ManagerProfileScreen() {
  const { data: wallet, isLoading } = useWallet();
  const { data: manager } = useManagerProfile();
  const [tab, setTab] = useState<TabKey>("seguranca");

  const name = wallet?.user?.name ?? "Gerente";
  const email = wallet?.user?.email ?? "";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Card className="p-6 md:p-8 relative overflow-hidden">
        <div
          className="absolute -top-24 -right-24 size-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)" }}
        />
        <div className="relative flex items-center gap-4 md:gap-5">
          <span className="flex size-16 md:size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-2xl md:text-3xl font-extrabold">
            {initial}
          </span>
          <div className="min-w-0">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-40 mb-2" />
                <Skeleton className="h-4 w-56" />
              </>
            ) : (
              <>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight truncate">{name}</h1>
                <p className="text-sm text-text-secondary truncate">{email}</p>
                {manager && (
                  <span className="mt-2 inline-flex rounded-full bg-purple/15 border border-purple/25 px-2.5 py-0.5 text-[11px] font-bold text-purple">
                    Gerente desde {new Date(manager.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
              tab === t.key
                ? "border-purple bg-purple/15 text-purple shadow-[0_0_18px_rgba(139,92,246,0.25)]"
                : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong hover:text-white"
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "seguranca" && <SecuritySection email={email} />}
      {tab === "sessoes" && <SessionsSection />}
    </div>
  );
}
