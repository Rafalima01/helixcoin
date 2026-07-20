import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        purple: "bg-purple/15 text-purple border border-purple/25",
        pink: "bg-pink/15 text-pink border border-pink/25",
        green: "bg-green/15 text-green border border-green/25",
        error: "bg-error/15 text-error border border-error/25",
        warning: "bg-warning/15 text-warning border border-warning/25",
        neutral: "bg-white/[0.06] text-text-secondary border border-border",
      },
      size: {
        sm: "text-[11px] px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {children}
    </span>
  );
}
