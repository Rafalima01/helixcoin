"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, AlertTriangle } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, refetch } = useNotifications();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white/[0.03] text-text-secondary hover:text-white hover:border-border-strong transition-colors"
        aria-label="Notificações"
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-pink text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 glass-card p-2 z-50"
          >
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="font-semibold text-sm">Notificações</p>
            </div>

            {isLoading && (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}

            {isError && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertTriangle className="size-6 text-error" />
                <p className="text-sm text-text-secondary">Erro ao carregar notificações</p>
                <button
                  onClick={() => refetch()}
                  className="text-xs text-purple font-semibold hover:text-pink"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!isLoading && !isError && data?.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                <BellOff className="size-7 text-text-muted" />
                <p className="text-sm text-text-secondary">Nenhuma notificação por aqui</p>
                <p className="text-xs text-text-muted">
                  Você será avisado sobre depósitos, saques e vitórias.
                </p>
              </div>
            )}

            {!isLoading &&
              !isError &&
              data?.map((n) => (
                <div
                  key={n.id}
                  className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-text-secondary">{n.message}</p>
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
