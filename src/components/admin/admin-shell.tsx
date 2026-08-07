"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ADMIN_NAV, findNavItem } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

/** Short display labels for the topbar identity chip — mirrors ROLE_META in src/app/admin/admins/page.tsx, kept minimal here since only the label is needed. */
const ROLE_SHORT_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  FINANCE: "Financeiro",
  OPERATOR: "Operador",
  MODERATOR: "Moderador",
  SUPPORT: "Suporte",
  COMPLIANCE: "Compliance",
  AUDIT: "Auditoria",
};

/**
 * Sidebar identity: the active item is marked by a solid accent rail plus a
 * raised surface — not a colored gradient wash. Icons sit on a fixed 16px
 * optical grid so labels align down the whole column regardless of glyph.
 */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    // min-h-0 + flex-1 (not h-full): as a flex child this lets the nav scroll
    // while the profile block stays pinned to the sidebar's bottom edge.
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
       * The game's own full logo lockup — same asset the player app uses, not
       * a text wordmark and not a Backoffice-specific variant. Stacked, with
       * the panel name as a small caption underneath, so the brand reads first
       * and "Backoffice" reads as a qualifier.
       */}
      <Link
        href="/"
        className="flex flex-col items-start gap-1.5 px-5 pb-5 pt-5"
        onClick={onNavigate}
        aria-label="HelixCoin Backoffice"
      >
        <Logo compact className="h-9 w-auto" />
        <span className="bo-overline pl-0.5 text-bo-muted">Backoffice</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
        {ADMIN_NAV.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="bo-overline px-3 pb-2 text-bo-muted/80">{group.label}</p>
            <div className="flex flex-col gap-px">
              {group.items.map((item) => {
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
          </div>
        ))}
      </nav>
    </div>
  );
}

/** Identity block pinned to the sidebar footer, Linear/Vercel style. */
function SidebarProfile() {
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 border-t border-bo-hairline px-4 py-3">
        <Skeleton className="size-7 rounded-bo-sm" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    );
  }
  if (!currentUser) return null;

  return (
    <div className="flex items-center gap-2.5 border-t border-bo-hairline px-4 py-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-bo-sm border border-bo-hairline-strong bg-bo-raised text-[11px] font-semibold text-bo-text">
        {currentUser.fullName.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-medium text-bo-text">{currentUser.fullName}</p>
        <p className="truncate text-[11px] text-bo-muted">
          {ROLE_SHORT_LABEL[currentUser.role] ?? currentUser.role}
        </p>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentItem = findNavItem(pathname);

  return (
    <div className="flex min-h-dvh" data-scope="backoffice">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-bo-hairline bg-bo-bg/60 backdrop-blur-xl lg:flex">
        <SidebarContent />
        <SidebarProfile />
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
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="fixed left-0 top-0 z-50 flex h-dvh w-[248px] flex-col border-r border-bo-hairline bg-bo-bg shadow-bo-overlay lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-bo-sm border border-bo-hairline text-bo-secondary transition-colors hover:text-bo-text"
                aria-label="Fechar menu"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
              <SidebarProfile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/*
         * Topbar carries orientation (breadcrumb) and alerts only. A global
         * search field deliberately stays out: there is no search backend
         * behind it, and an ornamental input that returns nothing is exactly
         * the kind of thing the design audit flagged as "parece real, não é".
         */}
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
              <span className="text-[13px] text-bo-muted">Backoffice</span>
              {currentItem && (
                <>
                  <ChevronRight className="size-3.5 shrink-0 text-bo-muted/60" strokeWidth={1.75} />
                  <span className="truncate text-[13px] font-medium text-bo-text">
                    {currentItem.label}
                  </span>
                </>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <Link
                href="/notifications"
                className="flex size-8 items-center justify-center rounded-bo-sm text-bo-secondary transition-colors hover:bg-white/[0.04] hover:text-bo-text"
                aria-label="Notificações"
              >
                <Bell className="size-4" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-7 lg:px-7 xl:py-9 2xl:max-w-[1600px]">
          {children}
        </main>
      </div>
    </div>
  );
}
