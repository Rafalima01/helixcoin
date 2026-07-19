"use client";

import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@prisma/client";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Erro ao carregar notificações");
      const json = await res.json();
      return json.notifications as Notification[];
    },
  });
}
