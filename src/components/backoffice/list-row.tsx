"use client";

/**
 * Shared row for vertical list screens (Aprovações, Notificações, Saques,
 * Minha Rede) — design audit §4/§5/§6 passo 04. Before this component,
 * each Manager screen hand-rolled its own version of the same
 * [avatar/icon] + [title/subtitle/meta] + [trailing] shape.
 */
import type { ReactNode } from "react";
import { Card, type CardProps } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ListRow({
  leading,
  title,
  titleClassName,
  subtitle,
  meta,
  trailing,
  footer,
  onClick,
  highlighted,
  className,
  ...cardProps
}: {
  leading?: ReactNode;
  title: ReactNode;
  /** Escape hatch for rows whose "title" isn't a name (e.g. a currency amount) — merged over the default via twMerge. */
  titleClassName?: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  /** Extra content below the row, inside the same card — e.g. the stats grid under a network row. */
  footer?: ReactNode;
  onClick?: () => void;
  /** Tints the row for an "unread"/"needs attention" state — never decorative. */
  highlighted?: boolean;
  className?: string;
} & Omit<CardProps, "children" | "onClick" | "title">) {
  return (
    <Card
      variant="list-row"
      className={cn(
        "flex flex-col gap-3",
        onClick && "cursor-pointer transition-colors",
        highlighted && "border-purple/30 bg-purple/[0.04]",
        className
      )}
      onClick={onClick}
      {...cardProps}
    >
      <div className="flex flex-wrap items-center gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0">
          <div className={cn("flex items-center gap-2 flex-wrap text-sm font-semibold truncate", titleClassName)}>
            {title}
          </div>
          {subtitle && <div className="text-xs text-text-secondary truncate">{subtitle}</div>}
          {meta && <div className="text-[11px] text-text-muted mt-0.5">{meta}</div>}
        </div>
        {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
      </div>
      {footer}
    </Card>
  );
}

const AVATAR_TONE = {
  purple: "bg-purple/15 text-purple",
  "purple-gradient": "bg-gradient-to-br from-purple/60 to-pink/60 text-white",
  muted: "bg-white/[0.04] text-text-muted",
} as const;

/** The circular initial/icon badge that sits in ListRow's `leading` slot. */
export function ListRowAvatar({
  children,
  tone = "purple",
  size = "md",
}: {
  children: ReactNode;
  tone?: keyof typeof AVATAR_TONE;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl font-bold",
        size === "md" ? "size-10 text-sm" : "size-9",
        AVATAR_TONE[tone]
      )}
    >
      {children}
    </span>
  );
}
