"use client";

import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-notifications";

export function ManagerNotificationsScreen() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Notificaç<span className="text-gradient-brand">ões</span>
          </h1>
          <p className="text-text-secondary mt-2">Novidades sobre sua rede de afiliados.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            <CheckCheck className="size-4" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-3 text-center">
          <BellOff className="size-8 text-text-muted" />
          <p className="font-semibold">Nenhuma notificação por aqui</p>
          <p className="text-sm text-text-secondary max-w-sm">
            Você será avisado sobre novos cadastros e novidades da sua rede.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "p-4 flex items-start gap-3 cursor-pointer transition-colors",
                !n.read && "border-purple/30 bg-purple/[0.04]"
              )}
              onClick={() => !n.read && markRead.mutate(n.id)}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  n.read ? "bg-white/[0.04] text-text-muted" : "bg-purple/15 text-purple"
                )}
              >
                <Bell className="size-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-sm text-text-secondary">{n.message}</p>
                <p className="text-[11px] text-text-muted mt-1">
                  {new Date(n.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              {!n.read && <span className="size-2 shrink-0 rounded-full bg-pink mt-1.5" />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
