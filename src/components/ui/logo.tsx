import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  if (iconOnly) {
    return (
      <Image
        src="/icon.png"
        alt="HeliJump"
        width={32}
        height={32}
        priority
        className={cn("shrink-0 select-none", className)}
      />
    );
  }

  return (
    <Image
      src="/logo-full.png"
      alt="HeliJump"
      width={1823}
      height={649}
      priority
      className={cn("h-10 w-auto select-none", className)}
    />
  );
}
