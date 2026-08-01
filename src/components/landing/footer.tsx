"use client";

import { motion } from "framer-motion";

export function Footer() {
  return (
    <footer className="relative border-t border-border py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-7xl px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted"
      >
        <p>© {new Date().getFullYear()} HelixCoin. Todos os direitos reservados.</p>
        <p>Jogue com responsabilidade. Proibido para menores de 18 anos.</p>
      </motion.div>
    </footer>
  );
}
