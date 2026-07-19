"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format?: (v: number) => string;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({
  value,
  format = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  className,
  duration = 0.8,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0.15 });
  const display = useTransform(spring, (v) => format(v));
  const prev = useRef(value);
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: "easeOut" });
    prev.current = value;
    return controls.stop;
  }, [value, duration, motionValue]);

  useEffect(() => {
    return display.on("change", (v) => {
      if (elRef.current) elRef.current.textContent = v;
    });
  }, [display]);

  return (
    <span ref={elRef} className={cn("tabular-nums", className)}>
      {format(value)}
    </span>
  );
}
