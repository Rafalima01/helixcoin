"use client";

import Link from "next/link";
import { UserMenu } from "@/components/app-shell/user-menu";
import { BalanceMenu } from "@/components/app-shell/balance-menu";
import { Logo } from "@/components/ui/logo";
import { useWallet } from "@/hooks/use-wallet";

export function Topbar() {
  const { data } = useWallet();

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 lg:px-8">
        {/* Single official asset (logo-icon.png) at every breakpoint — only
            the rendered height changes via CSS, never the source file. */}
        <Link href="/home" className="shrink-0">
          <Logo className="h-7 sm:h-9" />
        </Link>

        {/* Coin icon is the sole balance entry point — opens BalanceMenu's
            popover (Saldo total / Bônus / Total disponível + Sacar). The old
            "Saldo" pill + standalone "Depositar" button were removed —
            Depositar already has a fixed, more prominent home in BottomNav. */}
        <BalanceMenu />

        <div className="flex items-center gap-2 shrink-0">
          <UserMenu name={data?.user?.name ?? "Jogador"} email={data?.user?.email ?? ""} />
        </div>
      </div>
    </header>
  );
}
