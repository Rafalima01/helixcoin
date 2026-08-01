"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "glass-panel border-b border-border"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <nav className="mx-auto max-w-7xl px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-3">
        <Link href="/" aria-label="Helix Coin — início" className="shrink-0">
          <Image
            src="/logo-icon.png"
            alt="Helix Coin"
            width={1823}
            height={649}
            priority
            className="h-9 md:h-11 w-auto select-none"
          />
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/login">
            <Button variant="outline" size="sm">
              Entrar
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="gold" size="sm">
              Registrar
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
