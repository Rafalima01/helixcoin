"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLMotionProps<"div"> {
  glow?: "purple" | "pink" | "green" | "none";
  hoverLift?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = "none", hoverLift = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "glass-card p-6",
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
