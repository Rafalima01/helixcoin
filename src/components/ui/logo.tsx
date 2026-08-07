import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  iconOnly,
  compact,
}: {
  className?: string;
  iconOnly?: boolean;
  /**
   * Wordmark without the helix-tower badge. The full lockup packs an icon,
   * two type weights and a coin stack into a 2.8:1 box — legible on a
   * landing hero, mush at sidebar scale. This variant drops the badge so the
   * brand still reads at ~36px tall.
   */
  compact?: boolean;
}) {
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

  if (compact) {
    return (
      <Image
        src="/logo-icon-mobil.png"
        alt="HeliJump"
        width={2103}
        height={748}
        priority
        className={cn("h-9 w-auto select-none", className)}
      />
    );
  }

  return (
    <Image
      // Renamed from /logo-full.png -> /logo-icon.png in a prior commit
      // (public/ dir), but this reference was never updated — that's why
      // the full logo was 404ing and silently disappearing app-wide.
      src="/logo-icon.png"
      alt="HeliJump"
      width={1823}
      height={649}
      priority
      className={cn("h-10 w-auto select-none", className)}
    />
  );
}
