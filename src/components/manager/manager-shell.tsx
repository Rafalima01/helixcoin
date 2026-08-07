"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { MANAGER_NAV } from "@/lib/manager/nav";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    // min-h-0 + flex-1 (not h-full): as a flex child this lets the nav scroll
    // while the footer note stays pinned to the sidebar's bottom edge.
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Same lockup and stacking as the Admin panel — one brand, two panels. */}
      <Link
        href="/"
        className="flex flex-col items-start gap-1.5 px-5 pb-5 pt-5"
        onClick={onNavigate}
        aria-label="HelixCoin — Portal do Gerente"
      >
        <Logo compact className="h-9 w-auto" />
        <span className="bo-overline pl-0.5 text-bo-muted">Portal do Gerente</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
        <div className="flex flex-col gap-px">
          {MANAGER_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-bo-sm py-[7px] pl-3 pr-2.5 text-[13px] transition-colors duration-[120ms]",
                  active
                    ? "bg-white/[0.055] font-medium text-bo-text"
                    : "font-normal text-bo-secondary hover:bg-white/[0.03] hover:text-bo-text"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 h-[15px] w-[2px] -translate-y-1/2 rounded-full bg-bo-brand transition-opacity duration-[120ms]",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors duration-[120ms]",
                    active ? "text-bo-text" : "text-bo-muted group-hover:text-bo-secondary"
                  )}
                  strokeWidth={1.75}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-bo-hairline px-4 py-3">
        <p className="text-[11px] leading-relaxed text-bo-muted">
          Painel comercial — sem acesso à carteira/ledger da plataforma, apenas às próprias comissões e
          saques.
        </p>
      </div>
    </div>
  );
}

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentItem = MANAGER_NAV.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-dvh" data-scope="backoffice">
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 border-r border-bo-hairline bg-bo-bg/60 backdrop-blur-xl lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="fixed left-0 top-0 z-50 h-dvh w-[248px] border-r border-bo-hairline bg-bo-bg shadow-bo-overlay lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-bo-sm border border-bo-hairline text-bo-secondary transition-colors hover:text-bo-text"
                aria-label="Fechar menu"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-bo-hairline bg-bo-bg/70 backdrop-blur-xl">
          <div className="flex h-[52px] items-center gap-3 px-4 lg:px-7">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex size-8 items-center justify-center rounded-bo-sm border border-bo-hairline text-bo-secondary transition-colors hover:border-bo-hairline-strong hover:text-bo-text lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-4" strokeWidth={1.75} />
            </button>

            <nav aria-label="Trilha" className="hidden min-w-0 items-center gap-1.5 sm:flex">
              <span className="text-[13px] text-bo-muted">Gerente</span>
              {currentItem && (
                <>
                  <ChevronRight className="size-3.5 shrink-0 text-bo-muted/60" strokeWidth={1.75} />
                  <span className="truncate text-[13px] font-medium text-bo-text">
                    {currentItem.label}
                  </span>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-7 lg:px-7 xl:py-9 2xl:max-w-[1600px]">
          {children}
        </main>
      </div>
    </div>
  );
}
