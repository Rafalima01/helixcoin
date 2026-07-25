import { LayoutDashboard, ClipboardCheck, Network, Link2, Coins, Bell, User, type LucideIcon } from "lucide-react";

export interface ManagerNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Portal do Gerente — no Saques item: Manager has zero financial permission, confirmed by the user (see AGENTS.md Fase 8 decisions). */
export const MANAGER_NAV: ManagerNavItem[] = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/approvals", label: "Aprovações", icon: ClipboardCheck },
  { href: "/network", label: "Minha Rede", icon: Network },
  { href: "/links", label: "Links e Convites", icon: Link2 },
  { href: "/commissions", label: "Comissões", icon: Coins },
  { href: "/notifications", label: "Notificações", icon: Bell },
  { href: "/profile", label: "Perfil", icon: User },
];
