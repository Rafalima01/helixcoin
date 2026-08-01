"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Plus, Play, Gift, User } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT = [
  { href: "/deposit", label: "Depositar", icon: Plus },
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
  icon: typeof Plus;
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
 * breakpoint. Exactly five options, in order: Depositar, Sacar, Jogar
 * (elevated central CTA — same /home route as before, just renamed/re-iconed
 * from "Início"), Indique, Perfil.
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

          {/* Central CTA — Jogar (same /home route/behavior as the former "Início") */}
          <Link
            href="/home"
            aria-current={pathname === "/home" ? "page" : undefined}
            className="group relative flex flex-1 flex-col items-center justify-end gap-1 pb-2 text-[11px] font-semibold min-w-0"
          >
            <span
              className={cn(
                "absolute -top-7 flex size-14 items-center justify-center rounded-2xl",
                // Same gummy/arcade gold material as the app's primary CTAs
                // (Entrar, Cadastrar-se, Gerar QR Code PIX, Confirmar Saque) —
                // see the Button component's "gold" variant.
                "bg-gradient-to-b from-gold-bright via-gold to-gold-dim text-[#3a1e00]",
                "border border-[#8f4c06]/70",
                "shadow-[inset_0_1.5px_0_rgba(255,255,255,0.65),inset_0_-3px_0_rgba(0,0,0,0.25),0_10px_28px_-4px_rgba(201,106,11,0.6)]",
                "transition-all duration-200",
                "group-hover:scale-105 group-hover:-translate-y-0.5 group-hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.7),inset_0_-3px_0_rgba(0,0,0,0.3),0_12px_32px_-2px_rgba(201,106,11,0.75)]",
                "group-active:scale-100 group-active:translate-y-0 group-active:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.3),0_4px_10px_-2px_rgba(201,106,11,0.5)]",
                pathname === "/home" && "ring-2 ring-gold-bright/60"
              )}
            >
              <Play className="size-7" fill="currentColor" strokeWidth={2.6} />
            </span>
            <span
              className={cn(
                "truncate",
                pathname === "/home"
                  ? "text-gold"
                  : "text-text-secondary group-hover:text-gold"
              )}
            >
              Jogar
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
