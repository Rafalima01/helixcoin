"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowUpRight, Plus, Gift, User } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT = [
  { href: "/home", label: "Início", icon: Home },
  { href: "/withdraw", label: "Sacar", icon: ArrowUpRight },
];

const RIGHT = [
  { href: "/referrals", label: "Indique", icon: Gift },
  { href: "/profile", label: "Perfil", icon: User },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition-colors min-w-0",
        active ? "text-purple" : "text-text-secondary hover:text-white"
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl transition-all",
          active && "bg-purple/15 shadow-[0_0_18px_rgba(139,92,246,0.35)]"
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * Fixed bottom navigation dock — the app's primary navigation on every
 * breakpoint. Exactly five options; "Depositar" is the elevated central CTA.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-[max(env(safe-area-inset-bottom),0.75rem)] px-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto w-full max-w-md">
        <div className="relative flex items-stretch gap-1 rounded-3xl border border-border glass-panel px-2 pt-1.5 pb-1 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
          {LEFT.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}

          {/* Central CTA — Depositar */}
          <Link
            href="/deposit"
            aria-current={pathname === "/deposit" ? "page" : undefined}
            className="group relative flex flex-1 flex-col items-center justify-end gap-1 pb-2 text-[11px] font-semibold min-w-0"
          >
            <span
              className={cn(
                "absolute -top-7 flex size-14 items-center justify-center rounded-2xl",
                "bg-gradient-to-br from-green to-emerald-400 text-[#05261c]",
                "border border-white/25 shadow-[0_10px_32px_rgba(22,242,165,0.45)]",
                "transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5",
                pathname === "/deposit" && "ring-2 ring-green/60"
              )}
            >
              <Plus className="size-7" strokeWidth={2.6} />
            </span>
            <span
              className={cn(
                "truncate",
                pathname === "/deposit"
                  ? "text-green"
                  : "text-text-secondary group-hover:text-green"
              )}
            >
              Depositar
            </span>
          </Link>

          {RIGHT.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>
      </div>
    </nav>
  );
}
