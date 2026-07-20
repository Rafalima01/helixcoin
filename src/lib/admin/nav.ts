import {
  LayoutDashboard,
  LineChart,
  FileBarChart,
  Users,
  ShieldCheck,
  Gift,
  Wallet,
  BookOpenText,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Landmark,
  Gamepad2,
  LibraryBig,
  Percent,
  Megaphone,
  Bell,
  Settings,
  Plug,
  KeyRound,
  ScrollText,
  Fingerprint,
  Lock,
  ListTree,
  Activity,
  Server,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Backoffice information architecture — single source for sidebar + breadcrumbs. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: LineChart },
      { href: "/admin/reports", label: "Relatórios", icon: FileBarChart },
    ],
  },
  {
    label: "Usuários",
    items: [
      { href: "/admin/users", label: "Usuários", icon: Users },
      { href: "/admin/admins", label: "Administração", icon: ShieldCheck },
      { href: "/admin/permissions", label: "Permissões", icon: Lock },
      { href: "/admin/affiliates", label: "Afiliados", icon: Gift },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/admin/finance", label: "Financeiro", icon: Landmark },
      { href: "/admin/wallets", label: "Carteiras", icon: Wallet },
      { href: "/admin/ledger", label: "Ledger", icon: BookOpenText },
      { href: "/admin/deposits", label: "Depósitos", icon: ArrowDownToLine },
      { href: "/admin/withdrawals", label: "Saques", icon: ArrowUpFromLine },
      { href: "/admin/gateways", label: "Gateways", icon: CreditCard },
    ],
  },
  {
    label: "Jogo",
    items: [
      { href: "/admin/game", label: "Gestão do Jogo", icon: Gamepad2 },
      { href: "/admin/games", label: "Catálogo", icon: LibraryBig },
      { href: "/admin/rtp", label: "RTP", icon: Percent },
      { href: "/admin/promotions", label: "Promoções", icon: Megaphone },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { href: "/admin/notifications", label: "Notificações", icon: Bell },
      { href: "/admin/settings", label: "Configurações", icon: Settings },
      { href: "/admin/integrations", label: "Integrações", icon: Plug },
      { href: "/admin/api", label: "API Management", icon: KeyRound },
    ],
  },
  {
    label: "Operações",
    items: [
      { href: "/admin/audit", label: "Auditoria", icon: ClipboardList },
      { href: "/admin/logs", label: "Logs", icon: ScrollText },
      { href: "/admin/security", label: "Segurança", icon: Fingerprint },
      { href: "/admin/queues", label: "Filas", icon: ListTree },
      { href: "/admin/observability", label: "Observabilidade", icon: Activity },
      { href: "/admin/infrastructure", label: "Infraestrutura", icon: Server },
    ],
  },
];

export function findNavItem(pathname: string): AdminNavItem | undefined {
  for (const group of ADMIN_NAV) {
    const exact = group.items.find((i) => i.href === pathname);
    if (exact) return exact;
  }
  return undefined;
}
