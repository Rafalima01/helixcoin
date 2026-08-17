"use client";

import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/admin/ui";
import { ListRow, ListRowAvatar } from "@/components/backoffice/list-row";
import { NotificationMessage } from "@/components/notifications/notification-message";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-notifications";

const NOTIFICATION_DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };

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
        <EmptyState
          icon={BellOff}
          title="Nenhuma notificação por aqui"
          description="Você será avisado sobre novos cadastros e novidades da sua rede."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.map((n) => (
            <ListRow
              key={n.id}
              highlighted={!n.read}
              onClick={() => !n.read && markRead.mutate(n.id)}
              leading={
                <ListRowAvatar size="sm" tone={n.read ? "muted" : "purple"}>
                  <Bell className="size-4" />
                </ListRowAvatar>
              }
              title={n.title}
              subtitle={<NotificationMessage text={n.message} />}
              subtitleWrap
              meta={new Date(n.createdAt).toLocaleString("pt-BR", NOTIFICATION_DATE_FORMAT)}
              trailing={!n.read ? <span className="size-2 shrink-0 rounded-full bg-pink" /> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
