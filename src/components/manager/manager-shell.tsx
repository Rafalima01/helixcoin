"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { MANAGER_NAV } from "@/lib/manager/nav";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-4 pt-5 pb-4" onClick={onNavigate}>
        <Logo iconOnly />
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold">
            Heli<span className="text-gradient-brand">Jump</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Portal do Gerente
          </p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 scrollbar-none">
        <div className="flex flex-col gap-0.5">
          {MANAGER_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-gradient-to-r from-purple/25 to-pink/10 text-white border border-purple/30"
                    : "text-text-secondary hover:bg-white/[0.04] hover:text-white border border-transparent"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.02] px-3 py-2">
          <span className="size-2 shrink-0 rounded-full bg-text-muted" />
          <p className="text-[10px] text-text-muted leading-tight">
            Painel comercial — sem acesso a dados financeiros da plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentItem = MANAGER_NAV.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 border-r border-border glass-panel lg:block">
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
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed left-0 top-0 z-50 h-dvh w-[260px] border-r border-border glass-panel lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-lg border border-border text-text-secondary"
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border glass-panel">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex size-9 items-center justify-center rounded-xl border border-border text-text-secondary lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-4" />
            </button>

            <p className="hidden text-sm font-semibold text-text-secondary sm:block">
              {currentItem ? currentItem.label : "Portal do Gerente"}
            </p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
