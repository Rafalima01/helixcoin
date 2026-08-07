import { LayoutDashboard, ClipboardCheck, Network, Link2, Wallet, Bell, User, type LucideIcon } from "lucide-react";

export interface ManagerNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Portal do Gerente — the "zero financial permission" decision from
 * AGENTS.md's Fase 8 always meant zero visibility into the PLATFORM's
 * wallet/ledger (no Wallet/Ledger/Gateway access, see src/modules/manager's
 * schema doc comment), never that a Manager can't withdraw their OWN
 * commission balance. That reversal is what added the Saques tab below —
 * see src/modules/commercial-withdrawals, a separate admin-approved flow
 * that never touches the platform ledger a Manager still can't see.
 */
export const MANAGER_NAV: ManagerNavItem[] = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/approvals", label: "Aprovações", icon: ClipboardCheck },
  { href: "/network", label: "Minha Rede", icon: Network },
  { href: "/links", label: "Links e Convites", icon: Link2 },
  { href: "/withdrawals", label: "Saques", icon: Wallet },
  { href: "/notifications", label: "Notificações", icon: Bell },
  { href: "/profile", label: "Perfil", icon: User },
];
