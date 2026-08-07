import {
  LayoutDashboard,
  LineChart,
  FileBarChart,
  Users,
  ShieldCheck,
  Gift,
  Wallet,
  BookOpenText,
  Receipt,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Landmark,
  Gamepad2,
  LibraryBig,
  Percent,
  History,
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
  Webhook,
  FileClock,
  Briefcase,
  Coins,
  UserCheck,
  Smartphone,
  FlaskConical,
  HandCoins,
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
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: LineChart },
      { href: "/reports", label: "Relatórios", icon: FileBarChart },
    ],
  },
  {
    label: "Usuários",
    items: [
      { href: "/users", label: "Usuários", icon: Users },
      { href: "/admins", label: "Administração", icon: ShieldCheck },
      { href: "/permissions", label: "Permissões", icon: Lock },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/managers", label: "Gerentes", icon: Briefcase },
      { href: "/managers/requests", label: "Solicitações", icon: UserCheck },
      { href: "/affiliates", label: "Afiliados", icon: Gift },
      { href: "/affiliate-commissions", label: "Comissões", icon: Coins },
      { href: "/affiliate-settings", label: "Configurações", icon: Settings },
      { href: "/demo-accounts", label: "Contas Demo", icon: FlaskConical },
      { href: "/commercial-withdrawals", label: "Saques Comerciais", icon: HandCoins },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/finance", label: "Financeiro", icon: Landmark },
      { href: "/wallets", label: "Carteiras", icon: Wallet },
      { href: "/transactions", label: "Transações", icon: Receipt },
      { href: "/ledger", label: "Ledger", icon: BookOpenText },
    ],
  },
  {
    label: "Pagamentos",
    items: [
      { href: "/deposits", label: "Depósitos", icon: ArrowDownToLine },
      { href: "/withdrawals", label: "Saques", icon: ArrowUpFromLine },
      { href: "/gateways", label: "Gateways", icon: CreditCard },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/payment-logs", label: "Logs de Pagamento", icon: FileClock },
    ],
  },
  {
    label: "Jogo",
    items: [
      { href: "/game", label: "Gestão do Jogo", icon: Gamepad2 },
      { href: "/games", label: "Catálogo", icon: LibraryBig },
      { href: "/rtp", label: "RTP", icon: Percent },
      { href: "/matches", label: "Partidas", icon: History },
      { href: "/promotions", label: "Promoções", icon: Megaphone },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { href: "/notifications", label: "Notificações", icon: Bell },
      { href: "/push-notifications", label: "Push Notifications", icon: Smartphone },
      { href: "/settings", label: "Configurações", icon: Settings },
      { href: "/integrations", label: "Integrações", icon: Plug },
      { href: "/api", label: "API Management", icon: KeyRound },
    ],
  },
  {
    label: "Operações",
    items: [
      { href: "/audit", label: "Auditoria", icon: ClipboardList },
      { href: "/logs", label: "Logs", icon: ScrollText },
      { href: "/security", label: "Segurança", icon: Fingerprint },
      { href: "/queues", label: "Filas", icon: ListTree },
      { href: "/observability", label: "Observabilidade", icon: Activity },
      { href: "/infrastructure", label: "Infraestrutura", icon: Server },
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
