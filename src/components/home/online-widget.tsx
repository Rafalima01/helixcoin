"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
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
    <Card className="p-6 flex items-center gap-4">
      <div className="relative flex size-12 items-center justify-center rounded-2xl bg-green/15 border border-green/25">
        <Users className="size-5 text-green" />
        <motion.span
          className="absolute -top-1 -right-1 size-3 rounded-full bg-green"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      </div>
      <div>
        <p className="text-2xl font-extrabold tabular-nums">
          <AnimatedNumber value={count} format={(v) => Math.round(v).toLocaleString("pt-BR")} />
        </p>
        <p className="text-xs text-text-secondary">jogadores online agora</p>
      </div>
    </Card>
  );
}
