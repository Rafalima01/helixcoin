"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { NotificationPreferencesApi, ApiError } from "@/lib/notifications-api";

const CATEGORY_LABEL: Record<string, string> = {
  MANAGER_NETWORK_DEPOSIT_CONFIRMED: "Novo depósito confirmado na rede",
  MANAGER_NETWORK_AFFILIATE_REQUESTED: "Nova solicitação de afiliado",
};

/** Same pattern as SecuritySection/SessionsSection — a self-contained tab body. Only two categories, scoped to the manager's own network (see AGENTS.md's Fase X scope note — no global financial pushes here). */
export function PushNotificationsSection() {
  const { state, enable } = usePushNotifications();

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold">Notificações push</p>
            <p className="text-sm text-text-secondary">Receba um aviso no navegador quando algo acontecer na sua rede.</p>
          </div>
          <Button variant="primary" size="sm" loading={state === "subscribing"} onClick={() => void enable()}>
            {state === "subscribed" ? <BellRing className="size-4" /> : <Bell className="size-4" />}
            {state === "subscribed" ? "Ativas" : "Ativar"}
          </Button>
        </div>
        {state === "denied" && (
          <p className="mt-3 text-xs text-warning">Permissão negada pelo navegador — ative nas configurações do site.</p>
        )}
        {state === "unsupported" && <p className="mt-3 text-xs text-text-muted">Este navegador não suporta notificações push.</p>}
      </Card>

      <PreferencesPanel />
    </div>
  );
}

function PreferencesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => NotificationPreferencesApi.list(),
  });

  if (isLoading || !data) return <Skeleton className="h-28 w-full rounded-2xl" />;
  return <PreferencesForm key={data.data.map((p) => `${p.category}:${p.enabled}`).join(",")} preferences={data.data} />;
}

function PreferencesForm({ preferences }: { preferences: { category: string; enabled: boolean }[] }) {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState(preferences);

  const update = useMutation({
    mutationFn: ({ category, enabled }: { category: string; enabled: boolean }) => NotificationPreferencesApi.update(category, enabled),
    onSuccess: () => {
      toast.success("Preferência atualizada");
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atualizar preferência"),
  });

  return (
    <Card className="p-5">
      <p className="mb-3 font-bold">Categorias</p>
      <div className="flex flex-col gap-2">
        {local.map((pref) => (
          <label key={pref.category} className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={pref.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setLocal((rows) => rows.map((r) => (r.category === pref.category ? { ...r, enabled } : r)));
                update.mutate({ category: pref.category, enabled });
              }}
            />
            {CATEGORY_LABEL[pref.category] ?? pref.category}
          </label>
        ))}
      </div>
    </Card>
  );
}
