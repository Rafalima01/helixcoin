"use client";

import { useId } from "react";
import type { SeriesPointDTO } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

/**
 * Lightweight SVG chart primitives for the backoffice. No runtime deps, fully
 * responsive (viewBox-based), themed to the design tokens.
 */

export function Sparkline({
  data,
  color = "#8B5CF6",
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
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#sp-${id})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AreaChart({
  data,
  color = "#8B5CF6",
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

  return (
    <div className={className} style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={`ar-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
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
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 6"
          />
        ))}
        <path d={`${path} L${w},${h - padB} L0,${h - padB} Z`} fill={`url(#ar-${id})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {values.map((v, i) => (
          <circle key={i} cx={i * step} cy={y(v)} r="2.4" fill={color}>
            <title>{`${data[i].label}: ${formatValue(v)}`}</title>
          </circle>
        ))}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 ? (
            <text
              key={d.label}
              x={i * step}
              y={h - 6}
              fontSize="10"
              fill="rgba(178,175,194,0.7)"
              textAnchor={i === 0 ? "start" : "middle"}
            >
              {d.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export function BarChart({
  data,
  color = "#16F2A5",
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
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const w = 600;
  const h = 200;
  const padB = 22;
  const gap = 10;
  const bw = (w - gap * (data.length - 1)) / data.length;

  return (
    <div className={className} style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        {data.map((d, i) => {
          const bh = (d.value / max) * (h - padB - 12);
          return (
            <g key={d.label}>
              <rect
                x={i * (bw + gap)}
                y={h - padB - bh}
                width={bw}
                height={bh}
                rx="6"
                fill={color}
                opacity={0.28 + 0.55 * (d.value / max)}
              >
                <title>{`${d.label}: ${formatValue(d.value)}`}</title>
              </rect>
              <text
                x={i * (bw + gap) + bw / 2}
                y={h - 6}
                fontSize="10"
                fill="rgba(178,175,194,0.7)"
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const DONUT_COLORS = ["#8B5CF6", "#FF4FAE", "#16F2A5", "#FFD166", "#7DD3FC", "#FF4D6D"];

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

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        className="shrink-0 -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="12"
        />
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
              strokeWidth="12"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            >
              <title>{`${d.label}: ${formatValue(d.value)}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="flex flex-col gap-2 min-w-0">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-xs min-w-0">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="text-text-secondary truncate">{d.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{formatValue(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
