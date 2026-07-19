"use client";

import { motion } from "framer-motion";
import { HOW_IT_WORKS } from "@/lib/landing-data";

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-20 md:py-28 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col items-center text-center mb-16">
          <span className="text-sm font-semibold text-green uppercase tracking-widest mb-3">
            Simples assim
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Como <span className="text-gradient-brand">funciona</span>
          </h2>
        </div>

        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-purple/40 via-pink/40 to-green/40" />
          {HOW_IT_WORKS.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative z-10 flex size-[72px] items-center justify-center rounded-full glass-card text-2xl font-extrabold text-gradient-brand mb-5 glow-purple">
                {s.step}
              </div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-text-secondary max-w-[220px]">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
