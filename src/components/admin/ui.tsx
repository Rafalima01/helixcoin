"use client";

/**
 * Backoffice design-system primitives shared by every module screen.
 * All presentational — data always arrives via DTOs from the service layer.
 */
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Minus,
  Search,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/admin/charts";
import type { KpiDTO } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------- page header
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-text-secondary mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// -------------------------------------------------------------------- KPIs
export function KpiCard({ kpi, accent = "#8B5CF6" }: { kpi: KpiDTO; accent?: string }) {
  return (
    <Card className="p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted truncate">{kpi.label}</p>
        {kpi.delta && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              kpi.trend === "up" && "bg-green/15 text-green",
              kpi.trend === "down" && "bg-error/15 text-error",
              (!kpi.trend || kpi.trend === "flat") && "bg-white/[0.06] text-text-secondary"
            )}
          >
            {kpi.trend === "up" ? (
              <ArrowUpRight className="size-2.5" />
            ) : kpi.trend === "down" ? (
              <ArrowDownRight className="size-2.5" />
            ) : (
              <Minus className="size-2.5" />
            )}
            {kpi.delta}
          </span>
        )}
      </div>
      <p className="text-xl md:text-2xl font-extrabold tabular-nums truncate">{kpi.value}</p>
      {kpi.series && <Sparkline data={kpi.series} color={accent} />}
    </Card>
  );
}

export function KpiGrid({ kpis, accents }: { kpis: KpiDTO[]; accents?: string[] }) {
  const palette = accents ?? ["#8B5CF6", "#FF4FAE", "#16F2A5", "#7DD3FC"];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {kpis.map((k, i) => (
        <KpiCard key={k.id} kpi={k} accent={palette[i % palette.length]} />
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

// ------------------------------------------------------------- data table
export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyMessage = "Nenhum registro encontrado",
  pageSize = 8,
  onRowClick,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * pageSize, (current + 1) * pageSize);

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
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
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
                          c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                        )}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="size-7 text-text-muted" />
            <p className="text-sm text-text-secondary">{emptyMessage}</p>
          </div>
        )}
      </div>

      {rows.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
          <p className="text-xs text-text-muted tabular-nums">
            {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} de {rows.length}
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

export function Meter({ value, tone = "purple" }: { value: number; tone?: "purple" | "green" | "warning" | "error" }) {
  const colors = {
    purple: "from-purple to-pink",
    green: "from-green to-emerald-400",
    warning: "from-warning to-orange-400",
    error: "from-error to-rose-400",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", colors[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
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
