"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function OnlineWidget() {
  const [count, setCount] = useState(3247);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => Math.max(2800, c + Math.round((Math.random() - 0.45) * 18)));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-text-muted">
      <span className="relative flex size-1.5">
        <motion.span
          className="absolute inline-flex size-full rounded-full bg-green"
          animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <span className="relative inline-flex size-1.5 rounded-full bg-green" />
      </span>
      <span className="tabular-nums font-semibold text-text-secondary">
        <AnimatedNumber value={count} format={(v) => Math.round(v).toLocaleString("pt-BR")} />
      </span>
      online agora
    </div>
  );
}
