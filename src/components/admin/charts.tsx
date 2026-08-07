"use client";

import { useId, useRef, useState } from "react";
import type { SeriesPointDTO } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

/**
 * Lightweight SVG chart primitives for the backoffice. No runtime deps, fully
 * responsive (viewBox-based), themed to the design tokens — default series
 * colors resolve to the --bo-chart-* custom properties, so every chart that
 * doesn't pass an explicit `color` automatically follows the palette.
 */

const CHART_1 = "var(--bo-chart-1)";

export function Sparkline({
  data,
  color = CHART_1,
  className,
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  const id = useId();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - 4 - ((v - min) / range) * (h - 8)}`);
  const path = `M${points.join(" L")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#sp-${id})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Shared floating tooltip for AreaChart/BarChart — replaces the native
 * browser <title> tooltip (instant, unstyled, no delay control) with a
 * card-styled one that tracks the pointer, matching the audit's ask for
 * "tooltip elegante" instead of native title attributes.
 */
function ChartTooltip({
  x,
  y,
  label,
  value,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-[var(--bo-r-md)] border border-bo-hairline bg-bo-overlay px-2.5 py-1.5 text-xs shadow-bo-lg"
      style={{ left: x, top: y }}
    >
      <p className="text-bo-muted bo-caption">{label}</p>
      <p className="font-semibold tabular-nums text-bo-text">{value}</p>
    </div>
  );
}

export function AreaChart({
  data,
  color = CHART_1,
  height = 180,
  formatValue = (v: number) => String(v),
  className,
}: {
  data: SeriesPointDTO[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = 0;
  const max = Math.max(...values) * 1.15 || 1;
  const w = 600;
  const h = 200;
  const padB = 22;
  const step = w / (data.length - 1);
  const y = (v: number) => h - padB - ((v - min) / (max - min)) * (h - padB - 10);
  const points = values.map((v, i) => `${i * step},${y(v)}`);
  const path = `M${points.join(" L")}`;
  const gridLines = [0.25, 0.5, 0.75];

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.min(data.length - 1, Math.max(0, Math.round(relX / step)));
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!wrapRect) return;
    setHover({
      i,
      x: ((i * step) / w) * wrapRect.width,
      y: (y(values[i]) / h) * wrapRect.height,
    });
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`ar-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((g) => (
          <line
            key={g}
            x1="0"
            x2={w}
            y1={y(max * g)}
            y2={y(max * g)}
            stroke="var(--bo-hairline)"
            strokeDasharray="2 5"
          />
        ))}
        <path d={`${path} L${w},${h - padB} L0,${h - padB} Z`} fill={`url(#ar-${id})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="chart-draw-in"
        />
        {hover && (
          <line
            x1={hover.i * step}
            x2={hover.i * step}
            y1="0"
            y2={h - padB}
            stroke={color}
            strokeOpacity="0.3"
            strokeWidth="1"
          />
        )}
        {values.map((v, i) => (
          <circle
            key={i}
            cx={i * step}
            cy={y(v)}
            r={hover?.i === i ? 3.4 : 2}
            fill={hover?.i === i ? color : "var(--bo-surface)"}
            stroke={color}
            strokeWidth="1.4"
            className="transition-[r]"
          />
        ))}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 ? (
            <text
              key={d.label}
              x={i * step}
              y={h - 6}
              fontSize="10"
              fill="var(--bo-text-muted)"
              textAnchor={i === 0 ? "start" : "middle"}
            >
              {d.label}
            </text>
          ) : null
        )}
      </svg>
      {hover && (
        <ChartTooltip x={hover.x} y={hover.y} label={data[hover.i].label} value={formatValue(values[hover.i])} />
      )}
    </div>
  );
}

export function BarChart({
  data,
  color = "var(--bo-chart-4)",
  height = 180,
  formatValue = (v: number) => String(v),
  className,
}: {
  data: SeriesPointDTO[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const w = 600;
  const h = 200;
  const padB = 22;
  const gap = 10;
  const bw = (w - gap * (data.length - 1)) / data.length;

  const wrapRect = () => wrapRef.current?.getBoundingClientRect();

  return (
    <div ref={wrapRef} className={cn("relative", className)} style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        {data.map((d, i) => {
          const bh = (d.value / max) * (h - padB - 12);
          const active = hover?.i === i;
          return (
            <rect
              key={d.label}
              x={i * (bw + gap)}
              y={h - padB - bh}
              width={bw}
              height={bh}
              rx="4"
              fill={color}
              opacity={active ? 1 : 0.4 + 0.4 * (d.value / max)}
              className="chart-draw-in transition-opacity"
              onMouseEnter={() => {
                const r = wrapRect();
                if (!r) return;
                setHover({
                  i,
                  x: ((i * (bw + gap) + bw / 2) / w) * r.width,
                  y: ((h - padB - bh) / h) * r.height,
                });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {data.map((d, i) => (
          <text
            key={d.label}
            x={i * (bw + gap) + bw / 2}
            y={h - 6}
            fontSize="10"
            fill="var(--bo-text-muted)"
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}
      </svg>
      {hover && (
        <ChartTooltip x={hover.x} y={hover.y} label={data[hover.i].label} value={formatValue(data[hover.i].value)} />
      )}
    </div>
  );
}

const DONUT_COLORS = [
  "var(--bo-chart-1)",
  "var(--bo-chart-2)",
  "var(--bo-chart-3)",
  "var(--bo-chart-4)",
  "var(--bo-chart-5)",
];

export function DonutChart({
  data,
  size = 168,
  formatValue = (v: number) => String(v),
  className,
}: {
  data: SeriesPointDTO[];
  size?: number;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  // Cumulative start fraction for each slice, computed up-front (render-pure).
  const starts = data.map((_, i) => data.slice(0, i).reduce((a, d) => a + d.value / total, 0));
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        className="shrink-0 -rotate-90"
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bo-hairline)" strokeWidth="11" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = `${frac * c} ${c}`;
          const offset = -starts[i] * c;
          return (
            <circle
              key={d.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={hover === i ? 13 : 11}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              opacity={hover === null || hover === i ? 1 : 0.45}
              className="cursor-default transition-all"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      <div className="flex min-w-0 flex-col gap-2">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex min-w-0 items-center gap-2 text-xs transition-opacity"
            style={{ opacity: hover === null || hover === i ? 1 : 0.45 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="truncate text-bo-muted">{d.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-bo-text">{formatValue(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
