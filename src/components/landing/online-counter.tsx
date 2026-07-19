"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function OnlineCounter() {
  const [count, setCount] = useState(3247);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => Math.max(2800, c + Math.round((Math.random() - 0.45) * 18)));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/10 px-4 py-1.5">
      <span className="relative flex size-2">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-green"
          animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative inline-flex size-2 rounded-full bg-green" />
      </span>
      <span className="text-sm font-semibold text-green">
        <AnimatedNumber value={count} format={(v) => Math.round(v).toLocaleString("pt-BR")} />
      </span>
      <span className="text-sm text-text-secondary">jogadores online agora</span>
    </div>
  );
}
