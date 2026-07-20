import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl shimmer-bg border border-border/50", className)} aria-hidden />
  );
}
