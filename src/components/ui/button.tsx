"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-purple to-pink text-white shadow-[0_8px_24px_-4px_rgba(139,92,246,0.55)] hover:shadow-[0_8px_32px_-2px_rgba(255,79,174,0.6)]",
        // "Arcade dourado sobre roxo profundo" — the two game-CTA variants. Used
        // for Jogar/Jogar Agora/Registrar/promo CTAs only, never for
        // wallet/admin/utility actions (those stay on primary/secondary/etc.
        // below). Layered inset shadows simulate a physical bevel; active
        // state presses down. font-display carries the arcade identity into
        // the label itself — see globals.css --font-display.
        gold:
          "font-display tracking-wide bg-gradient-to-b from-gold-bright via-gold to-gold-dim text-[#3a1e00] border border-[#8f4c06]/70 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.65),inset_0_-3px_0_rgba(0,0,0,0.25),0_8px_20px_-4px_rgba(201,106,11,0.6)] hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.7),inset_0_-3px_0_rgba(0,0,0,0.3),0_10px_28px_-2px_rgba(201,106,11,0.75)] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.3),0_4px_10px_-2px_rgba(201,106,11,0.5)] active:translate-y-[1px]",
        arcade:
          "font-display tracking-wide bg-gradient-to-b from-[#a98bfa] via-primary to-purple-dim text-white border border-[#4c2a99]/70 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(0,0,0,0.25),0_8px_20px_-4px_rgba(139,92,246,0.6)] hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.55),inset_0_-3px_0_rgba(0,0,0,0.3),0_10px_28px_-2px_rgba(139,92,246,0.75)] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3),0_4px_10px_-2px_rgba(139,92,246,0.5)] active:translate-y-[1px]",
        secondary:
          "glass-panel text-text border border-border hover:border-border-strong hover:bg-card-hover",
        success:
          "bg-gradient-to-r from-green to-emerald-400 text-[#05261c] shadow-[0_8px_24px_-4px_rgba(22,242,165,0.5)] hover:shadow-[0_8px_32px_-2px_rgba(22,242,165,0.65)]",
        danger:
          "bg-gradient-to-r from-error to-rose-600 text-white shadow-[0_8px_24px_-4px_rgba(255,77,109,0.5)]",
        ghost: "text-text-secondary hover:text-text hover:bg-white/5",
        outline:
          "border border-border-strong text-text hover:border-purple/60 hover:text-purple bg-transparent",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-xl",
        md: "h-12 px-6 text-[15px] rounded-2xl",
        lg: "h-14 px-8 text-base rounded-2xl",
        icon: "h-11 w-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        // Styling hooks, not behavior: the Backoffice restyles every variant
        // from CSS under [data-scope="backoffice"] without forking this
        // component or touching a single call site. The player app ignores them.
        data-variant={variant ?? "primary"}
        data-size={size ?? "md"}
        data-loading={loading ? "" : undefined}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
