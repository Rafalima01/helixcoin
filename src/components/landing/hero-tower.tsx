"use client";

import { motion } from "framer-motion";

const RINGS = [
  { size: 340, color: "#8B5CF6", duration: 22, gap: 0.36, delay: 0 },
  { size: 280, color: "#FF4FAE", duration: 18, gap: 0.28, delay: 0.1, reverse: true },
  { size: 220, color: "#16F2A5", duration: 26, gap: 0.42, delay: 0.2 },
  { size: 160, color: "#8B5CF6", duration: 14, gap: 0.3, delay: 0.05, reverse: true },
];

export function HeroTower() {
  return (
    <div className="relative w-full aspect-square max-w-[440px] mx-auto flex items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(255,79,174,0.18) 45%, transparent 70%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {RINGS.map((ring, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: ring.size,
            height: ring.size,
            border: `2.5px dashed ${ring.color}`,
            opacity: 0.55,
          }}
          animate={{ rotate: ring.reverse ? -360 : 360 }}
          transition={{ duration: ring.duration, repeat: Infinity, ease: "linear", delay: ring.delay }}
        />
      ))}

      {RINGS.map((ring, i) => (
        <motion.div
          key={`platform-${i}`}
          className="absolute rounded-full"
          style={{ width: ring.size, height: ring.size }}
          animate={{ rotate: ring.reverse ? -360 : 360 }}
          transition={{ duration: ring.duration, repeat: Infinity, ease: "linear", delay: ring.delay }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: ring.size * ring.gap,
              height: 10,
              top: -5,
              left: "50%",
              marginLeft: -(ring.size * ring.gap) / 2,
              background: ring.color,
              boxShadow: `0 0 16px 2px ${ring.color}`,
            }}
          />
        </motion.div>
      ))}

      <motion.div
        className="relative size-16 rounded-full bg-gradient-to-br from-white to-white/60"
        style={{ boxShadow: "0 0 40px 8px rgba(255,255,255,0.5)" }}
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
