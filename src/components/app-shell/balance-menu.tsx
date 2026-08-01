"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency } from "@/lib/utils";

/**
 * Coin icon + current balance in the Topbar — the sole entry point to
 * balance info now that the big "Saldo" card was removed from the header.
 * Opens a small popover with Saldo total / Bônus / Total disponível
 * (main + bonus, a display-only sum — not a new financial rule) and a
 * "Sacar" shortcut that reuses the existing /withdraw flow as-is. The coin
 * artwork is the official asset provided for this UI — resized only, pixels
 * untouched (public/coin-icon.webp).
 */
export function BalanceMenu() {
  const { data, isLoading } = useWallet();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  const main = centsToReais(data?.balance ?? 0);
  const bonus = centsToReais(data?.bonus ?? 0);
  const totalAvailable = main + bonus;

  // Close on navigation (both route changes and clicking "Sacar" itself) —
  // adjusted during render (React's documented pattern for resetting state
  // in response to a changed value) via useState, not useRef, so it stays
  // safe under this project's stricter react-hooks/refs rule.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Saldo"
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 pl-1.5 pr-3 transition-colors hover:bg-gold/15"
      >
        <Image src="/coin-icon.webp" alt="" width={22} height={22} className="shrink-0" />
        {isLoading ? (
          <Skeleton className="h-3.5 w-14" />
        ) : (
          <span className="text-sm font-semibold tabular-nums">
            <AnimatedNumber value={main} format={formatCurrency} />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 top-full z-50 mt-2 w-[min(260px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-border glass-panel p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
          >
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Saldo total</span>
                  <span className="font-semibold tabular-nums">
                    <AnimatedNumber value={main} format={formatCurrency} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Bônus</span>
                  <span className="font-semibold tabular-nums text-gold">
                    <AnimatedNumber value={bonus} format={formatCurrency} />
                  </span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total disponível</span>
                  <span className="font-extrabold tabular-nums text-green">
                    <AnimatedNumber value={totalAvailable} format={formatCurrency} />
                  </span>
                </div>
              </div>
            )}

            <Link href="/withdraw" className="mt-4 block">
              <Button variant="secondary" size="sm" className="w-full">
                <ArrowUpRight className="size-4" />
                Sacar
              </Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
