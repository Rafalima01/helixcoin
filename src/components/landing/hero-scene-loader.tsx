"use client";

import dynamic from "next/dynamic";

/** @react-three/fiber's Canvas needs a live WebGL context — never SSR it. */
export const HeroScene = dynamic(() => import("@/components/landing/hero-scene"), {
  ssr: false,
  loading: () => (
    <div className="relative aspect-square w-full max-w-[440px] mx-auto">
      <div className="absolute inset-0 rounded-full bg-gold-soft blur-3xl animate-glow-pulse" />
    </div>
  ),
});
