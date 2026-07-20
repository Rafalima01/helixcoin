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
