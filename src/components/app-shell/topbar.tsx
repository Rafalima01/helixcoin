"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { NotificationsBell } from "@/components/app-shell/notifications-bell";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Logo } from "@/components/ui/logo";
import { useWallet } from "@/hooks/use-wallet";
import { centsToReais } from "@/lib/multiplier";
import { Skeleton } from "@/components/ui/skeleton";

export function Topbar() {
  const { data, isLoading } = useWallet();
  const balance = centsToReais(data?.balance ?? 0);

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 lg:px-8">
        <Link href="/home" className="shrink-0">
          <Logo iconOnly className="sm:hidden" />
          <span className="hidden sm:block">
            <Logo />
          </span>
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          {isLoading ? (
            <Skeleton className="h-9 w-28" />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.03] px-3.5 h-9 min-w-0">
              <span className="text-xs text-text-muted hidden sm:inline">Saldo</span>
              <span className="font-bold text-green text-[15px] truncate">
                R$ <AnimatedNumber value={balance} />
              </span>
            </div>
          )}
          <Link href="/deposit" className="hidden md:block">
            <Button variant="primary" size="sm">
              <Plus className="size-4" />
              Depositar
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationsBell />
          <UserMenu name={data?.user?.name ?? "Jogador"} email={data?.user?.email ?? ""} />
        </div>
      </div>
    </header>
  );
}
