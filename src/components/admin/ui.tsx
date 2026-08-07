"use client";

/**
 * Backoffice design-system primitives shared by every module screen.
 * All presentational — data always arrives via DTOs from the service layer.
 */
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Copy,
  Inbox,
  type LucideIcon,
  Minus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/admin/charts";
import type { KpiDTO, TrendDirection } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------- mock badge
/**
 * Marks a screen or section whose data/actions are not wired to a real
 * backend yet — see design audit §5 "MockBadge". Never decorative: every
 * instance corresponds to an entry in the audit's P0 mock-screen list.
 */
export function MockBadge({ label = "Em breve" }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
      <span className="size-1.5 rounded-full bg-warning" />
      {label}
    </span>
  );
}

// ------------------------------------------------------------- page header
export function PageHeader({
  title,
  description,
  actions,
  mock,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Renders a MockBadge next to the title — see design audit §5/§2 (P0). */
  mock?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">{title}</h1>
          {mock && <MockBadge />}
        </div>
        {description && <p className="text-sm text-text-secondary mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// -------------------------------------------------------------------- KPIs
/**
 * Trend → color is the only mapping KpiCard uses (design audit §2 P0 /
 * §5 "paleta"): purple stays reserved for brand/nav, green/red are state
 * only, and a KPI with no real trend renders neutral — never a color
 * picked by array position.
 */
const TREND_COLOR: Record<TrendDirection, string> = {
  up: "var(--color-positive)",
  down: "var(--color-danger)",
  flat: "var(--color-muted)",
};

function TrendBadge({ trend, delta, size = "sm" }: { trend: TrendDirection; delta: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full font-bold",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        trend === "up" && "bg-green/15 text-green",
        trend === "down" && "bg-error/15 text-error",
        trend === "flat" && "bg-white/[0.06] text-text-secondary"
      )}
    >
      {trend === "up" ? (
        <ArrowUpRight className={size === "sm" ? "size-2.5" : "size-3.5"} />
      ) : trend === "down" ? (
        <ArrowDownRight className={size === "sm" ? "size-2.5" : "size-3.5"} />
      ) : (
        <Minus className={size === "sm" ? "size-2.5" : "size-3.5"} />
      )}
      {delta}
    </span>
  );
}

export function KpiCard({ kpi }: { kpi: KpiDTO }) {
  const trend = kpi.trend ?? "flat";
  return (
    <Card className="p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted truncate">
          {kpi.label}
        </p>
        {kpi.delta && <TrendBadge trend={trend} delta={kpi.delta} />}
      </div>
      <p className="text-xl md:text-2xl font-extrabold tabular-nums truncate">{kpi.value}</p>
      {kpi.series && <Sparkline data={kpi.series} color={TREND_COLOR[trend]} />}
    </Card>
  );
}

export function KpiGrid({ kpis }: { kpis: KpiDTO[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <KpiCard key={k.id} kpi={k} />
      ))}
    </div>
  );
}

/**
 * The "3–4 hero métricas" the design audit calls for on the Admin Dashboard
 * (§2 P1, §3 Fase 3, §6 passo 08) — a handful of numbers get real
 * typographic weight instead of the ~37 same-size cards that came before.
 */
export function HeroKpiCard({ kpi }: { kpi: KpiDTO }) {
  const trend = kpi.trend ?? "flat";
  return (
    <Card className="p-5 flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted truncate">{kpi.label}</p>
        {kpi.delta && <TrendBadge trend={trend} delta={kpi.delta} size="md" />}
      </div>
      <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold tabular-nums">{kpi.value}</p>
      {kpi.series && <Sparkline data={kpi.series} color={TREND_COLOR[trend]} className="h-10" />}
    </Card>
  );
}

export function HeroKpiGrid({ kpis }: { kpis: KpiDTO[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <HeroKpiCard key={k.id} kpi={k} />
      ))}
    </div>
  );
}

/**
 * Shared loading placeholder for KpiGrid/HeroKpiGrid (design audit §4
 * "Skeleton ad hoc por página" / §6 passo 12) — every dashboard-style screen
 * used to hand-roll its own `Array.from({length:n}).map(() => <Skeleton/>)`
 * grid with a slightly different shape each time. One component, matching
 * each grid's real column breakpoints and card height, so the loading state
 * never jumps when the data arrives.
 */
export function KpiGridSkeleton({ count = 4, variant = "grid" }: { count?: number; variant?: "grid" | "hero" }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        variant === "hero" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-2xl", variant === "hero" ? "h-32" : "h-28")} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------ status badge
const STATUS_STYLES: Record<string, string> = {
  // generic tones
  success: "bg-green/15 text-green border-green/25",
  warning: "bg-warning/15 text-warning border-warning/25",
  danger: "bg-error/15 text-error border-error/25",
  info: "bg-purple/15 text-purple border-purple/25",
  neutral: "bg-white/[0.06] text-text-secondary border-border",
  pink: "bg-pink/15 text-pink border-pink/25",
};

export function StatusBadge({
  tone,
  children,
  pulse,
}: {
  tone: keyof typeof STATUS_STYLES;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        STATUS_STYLES[tone]
      )}
    >
      <span className={cn("size-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
      {children}
    </span>
  );
}

/**
 * Priority signal for decision tables (design audit §2 P2, §5, §6 passo
 * 09) — Afiliados and Solicitações both made an admin open every drawer to
 * find out which item is stale. Reads straight off a timestamp already in
 * the row DTO, no new data: neutral under the threshold, warning at/after
 * it — never decorative.
 */
export function PriorityHint({ since, thresholdDays = 7 }: { since: string; thresholdDays?: number }) {
  // Lazy initializer, not a render-time call: react-hooks/purity's documented
  // escape hatch for capturing an impure "now" once per mount.
  const [now] = useState(() => Date.now());
  const days = Math.floor((now - new Date(since).getTime()) / 86_400_000);
  const urgent = days >= thresholdDays;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap",
        urgent ? "text-warning" : "text-text-muted"
      )}
    >
      {urgent && <Clock className="size-3" />}
      {days <= 0 ? "hoje" : `${days}d aguardando`}
    </span>
  );
}

// ---------------------------------------------------- empty / error states
/**
 * Shared "nothing here" state (design audit §5/§6 passo 12) — successor to
 * DataTable's old inline `<Inbox/>` block, now reusable by any screen that
 * renders a list outside a table (e.g. the Manager's ListRow screens).
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-text-muted">
        <Icon className="size-6" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="text-xs text-text-secondary max-w-sm">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Shared query-failure state (design audit §5/§6 passo 12) — before this,
 * no screen distinguished "still loading" from "the request failed"; a
 * broken query just left the table looking permanently empty. `onRetry`
 * is meant to be a query's own `refetch`.
 */
export function ErrorState({
  title = "Não foi possível carregar os dados",
  description = "Tente novamente em instantes. Se o problema continuar, contate o time técnico.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-error/10 text-error">
        <AlertTriangle className="size-6" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-text-secondary max-w-sm">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-white"
        >
          <RotateCw className="size-3.5" /> Tentar novamente
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------- data table
export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
}

function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-b border-border/50">
          {Array.from({ length: columns }, (_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyMessage = "Nenhum registro encontrado",
  pageSize = 8,
  onRowClick,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  loading?: boolean;
  /** True when the underlying query failed — renders ErrorState instead of the table body. */
  error?: boolean;
  /** Wired to the query's own `refetch`; shows a "Tentar novamente" button when set. */
  onRetry?: () => void;
  emptyMessage?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * pageSize, (current + 1) * pageSize);

  if (error) {
    return (
      <Card className="overflow-hidden">
        <ErrorState onRetry={onRetry} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted",
                    c.align === "right"
                      ? "text-right"
                      : c.align === "center"
                        ? "text-center"
                        : "text-left"
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <TableSkeleton columns={columns.length} />
              : slice.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-border/50 last:border-0 transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-white/[0.03]" : "hover:bg-white/[0.02]"
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-3 align-middle",
                          c.align === "right"
                            ? "text-right"
                            : c.align === "center"
                              ? "text-center"
                              : "text-left"
                        )}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <EmptyState title={emptyMessage} />}
      </div>

      {rows.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
          <p className="text-xs text-text-muted tabular-nums">
            {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} de{" "}
            {rows.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, current - 1))}
              disabled={current === 0}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:text-white disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-xs text-text-secondary tabular-nums">
              {current + 1}/{pages}
            </span>
            <button
              onClick={() => setPage(Math.min(pages - 1, current + 1))}
              disabled={current >= pages - 1}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:text-white disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// -------------------------------------------------------------- filter bar
export function FilterBar({
  search,
  onSearch,
  placeholder = "Buscar...",
  children,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-border bg-white/[0.03] pl-9 pr-3 text-sm outline-none transition-all focus:border-purple/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
        />
      </div>
      {children}
    </div>
  );
}

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
            value === o.value
              ? "border-purple bg-purple/15 text-purple"
              : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- tabs
export function AdminTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white/[0.02] p-1 scrollbar-none">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all",
            value === t.key
              ? "bg-purple/20 text-white shadow-[0_0_16px_rgba(139,92,246,0.2)]"
              : "text-text-secondary hover:text-white"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ drawer
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed right-0 top-0 z-50 h-dvh w-full max-w-md overflow-y-auto border-l border-border glass-panel p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:text-white"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// --------------------------------------------------------------- sections
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">{title}</h3>
          {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

/**
 * Purpose-built successor to SectionCard for a card whose content is a
 * chart — design audit §4/§5/§6 passo 07. Same shape as SectionCard today
 * (kept as a distinct component, not an alias, so its identity survives
 * once SectionCard is retired in a later step).
 */
export function ChartCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">{title}</h3>
          {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

// -------------------------------------------------------------- settings
/**
 * Purpose-built successor to SectionCard for a card whose content is a form
 * — design audit §4/§5/§6 passo 07. Renders as a single bordered group with
 * one row per rule (label+description left, control right), the
 * Stripe/Linear settings pattern the audit calls for — never a grid of
 * one-card-per-field.
 */
export function SettingsGroup({
  title,
  description,
  actions,
  mock,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Renders a MockBadge next to the title — see §5/§2 (P0). */
  mock?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-0 overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-bold">{title}</h3>
            {mock && <MockBadge />}
          </div>
          {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  );
}

export function SettingsRow({
  label,
  description,
  mock,
  children,
}: {
  label: string;
  description?: string;
  /** Renders a MockBadge next to the label — see §5/§2 (P0). */
  mock?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0 max-w-md">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{label}</p>
          {mock && <MockBadge />}
        </div>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Meter({
  value,
  tone = "purple",
}: {
  value: number;
  tone?: "purple" | "green" | "warning" | "error";
}) {
  const colors = {
    purple: "from-purple to-pink",
    green: "from-green to-emerald-400",
    warning: "from-warning to-orange-400",
    error: "from-error to-rose-400",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r transition-all duration-500",
          colors[tone]
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/**
 * Shared Drawer loading placeholder (design audit §5 "Novos componentes" /
 * §6 passo 12) — successor to the plain "Carregando..." text every drawer
 * used while its detail query was in flight. Mirrors DetailRow's own
 * layout (label left, value right, divider) so the skeleton is shaped like
 * the content it's about to become, not a generic box.
 */
export function DrawerSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-right">{value}</span>
    </div>
  );
}

// ------------------------------------------------------------ json viewer
/**
 * Escapes the JSON text first, then wraps already-escaped tokens in a
 * fixed-class <span> — never echoes attacker-controlled markup (webhook
 * payloads are external input), so this is safe to feed to
 * dangerouslySetInnerHTML.
 */
function highlightJson(json: string): string {
  const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let tone = "text-[#e5c07b]"; // number
      if (/^"/.test(match)) tone = /:$/.test(match) ? "text-[#61afef]" : "text-[#98c379]"; // key vs string
      else if (/true|false/.test(match)) tone = "text-[#c678dd]"; // boolean
      else if (/null/.test(match)) tone = "text-text-muted"; // null
      return `<span class="${tone}">${match}</span>`;
    }
  );
}

/**
 * Purpose-built successor to a raw `<pre>{JSON.stringify(...)}}</pre>`
 * block (design audit §2 P2, §5, §6 passo 11) — syntax-highlighted,
 * collapsible, copyable. Used for Webhooks payload/response, Payment Logs
 * request/response, and Transações metadata.
 */
export function JsonViewer({ data, label, collapsedByDefault = false }: { data: unknown; label?: string; collapsedByDefault?: boolean }) {
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — text stays selectable in the <pre>, nothing to report.
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        {label && <p className="text-[11px] font-semibold text-text-muted">{label}</p>}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary"
          >
            {collapsed ? <ChevronsUpDown className="size-3" /> : <ChevronsDownUp className="size-3" />}
            {collapsed ? "Expandir" : "Recolher"}
          </button>
          <button type="button" onClick={copy} className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary">
            {copied ? <Check className="size-3 text-green" /> : <Copy className="size-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <pre
          className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlightJson(json) }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ledger
/**
 * Purpose-built pairing for a double-entry ledger line (design audit §2
 * P2, §5, §6 passo 11) — replaces two independent "Débito"/"Crédito" table
 * columns with one compound cell that actually reads as a ledger entry.
 * Neutral styling on both sides: debit/credit is bookkeeping mechanics,
 * not a good/bad state, so it never borrows the status color vocabulary.
 */
export function LedgerRow({ debitAccount, creditAccount }: { debitAccount: string; creditAccount: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-text-secondary whitespace-nowrap">
      <span className="rounded-md border border-border bg-white/[0.03] px-1.5 py-0.5">{debitAccount}</span>
      <ArrowRight className="size-3 shrink-0 text-text-muted" />
      <span className="rounded-md border border-border bg-white/[0.03] px-1.5 py-0.5">{creditAccount}</span>
    </div>
  );
}
