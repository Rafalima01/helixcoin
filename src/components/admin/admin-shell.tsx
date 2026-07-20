"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Menu, Search, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ADMIN_NAV, findNavItem } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2.5 px-4 pt-5 pb-4" onClick={onNavigate}>
        <Logo iconOnly />
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold">
            Heli<span className="text-gradient-brand">Jump</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Backoffice
          </p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 scrollbar-none">
        {ADMIN_NAV.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-text-muted/70">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
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
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-xl border border-green/25 bg-green/[0.06] px-3 py-2">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-green shadow-[0_0_8px_rgba(22,242,165,0.8)]" />
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-semibold">Todos os sistemas operacionais</p>
            <p className="text-[10px] text-text-muted">Ambiente: Produção · v2.4.1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentItem = findNavItem(pathname);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 border-r border-border glass-panel lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile / tablet drawer */}
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
        {/* Topbar */}
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
              {currentItem ? currentItem.label : "Backoffice"}
            </p>

            <div className="ml-auto flex items-center gap-2">
              <button className="hidden h-9 items-center gap-2 rounded-xl border border-border bg-white/[0.03] px-3 text-xs text-text-muted transition-colors hover:border-border-strong md:flex">
                <Search className="size-3.5" />
                Buscar em tudo…
                <kbd className="rounded border border-border bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold">
                  Ctrl K
                </kbd>
              </button>

              <button
                className="relative flex size-9 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:text-white"
                aria-label="Alertas"
              >
                <Bell className="size-4" />
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-white">
                  4
                </span>
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.03] py-1 pl-1 pr-2.5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple to-pink text-xs font-bold">
                  R
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className="text-xs font-semibold">Rafael Lima</p>
                  <p className="flex items-center gap-1 text-[10px] text-text-muted">
                    <ShieldCheck className="size-2.5" /> Owner
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
