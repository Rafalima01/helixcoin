"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/**
 * Filter pill — extracted from the identical markup repeated in
 * transactions-list.tsx and game-history.tsx (Tudo/Depósitos/Saques,
 * Tudo/Hoje/Ontem, ...). Any new filter row should use this instead of
 * re-inlining the same className string.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
        active
          ? "border-purple bg-purple/15 text-purple"
          : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong",
        className
      )}
      {...props}
    />
  )
);
Chip.displayName = "Chip";
