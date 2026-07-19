"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import { LogOut, User, Gift } from "lucide-react";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = name?.charAt(0)?.toUpperCase() ?? "U";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.03] pl-1 pr-2.5 py-1 hover:border-border-strong transition-colors"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple to-pink text-sm font-bold">
          {initial}
        </span>
        <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">{name}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 glass-card p-2 z-50"
          >
            <div className="px-3 py-2.5 border-b border-border mb-1">
              <p className="font-semibold text-sm truncate">{name}</p>
              <p className="text-xs text-text-muted truncate">{email}</p>
            </div>

            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            >
              <User className="size-4" />
              Perfil
            </Link>
            <Link
              href="/referrals"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            >
              <Gift className="size-4" />
              Indique e Ganhe
            </Link>

            <div className="h-px bg-border my-1" />

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-error hover:bg-error/10 transition-colors"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
