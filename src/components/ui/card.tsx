"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLMotionProps<"div"> {
  glow?: "purple" | "pink" | "green" | "none";
  hoverLift?: boolean;
  /**
   * "surface" (default) — the existing sober glass-card treatment, for
   * financial/data surfaces (wallet, transactions, tables, settings): stays
   * exactly as it always was, zero visual change for any existing usage.
   * "arcade" — gold-accented treatment for gameplay/social surfaces
   * (achievements, live activity, promo cards): opt-in only, no current
   * usage is switched to it by this change.
   */
  variant?: "surface" | "arcade";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = "none", hoverLift = false, variant = "surface", children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "p-6",
          variant === "surface" && "glass-card",
          variant === "arcade" &&
            "rounded-[var(--radius-card)] border border-gold/30 bg-gradient-to-b from-surface-elevated to-surface shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
          glow === "purple" && "glow-purple",
          glow === "pink" && "glow-pink",
          glow === "green" && "glow-green",
          hoverLift &&
            "transition-transform duration-300 hover:-translate-y-1 hover:border-border-strong",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
Card.displayName = "Card";
