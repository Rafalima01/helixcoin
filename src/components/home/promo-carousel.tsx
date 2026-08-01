"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PromoBanner {
  src: string;
  alt: string;
}

/** Official campaign banners — real assets, not placeholders. Single carousel slot (replaces the old "ganhadores" ticker area on Home), never three cards at once. */
const BANNERS: PromoBanner[] = [
  { src: "/home-banner-pix.webp", alt: "Saque no Pix — receba na hora" },
  { src: "/home-banner-seguro.webp", alt: "Plataforma segura e legalizada — SIGAP, RA1000" },
  { src: "/home-banner-comunidade.webp", alt: "Entre para a comunidade — sorteios todos os dias" },
];

const INTERVAL_MS = 5000;

export function PromoCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % BANNERS.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-8 pt-4">
      {/* Fixed aspect ratio (the widest banner's own ratio) so the frame never
          jumps size between slides; object-cover preserves each asset's own
          proportions (no stretching/deforming) while filling that frame. */}
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-card)] border border-border shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        style={{ aspectRatio: "1774 / 887" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Image
              src={BANNERS[index].src}
              alt={BANNERS[index].alt}
              fill
              priority={index === 0}
              sizes="(min-width: 768px) 720px, 100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {BANNERS.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1.5">
            {BANNERS.map((b, i) => (
              <button
                key={b.src}
                type="button"
                aria-label={`Banner ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "pointer-events-auto h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
