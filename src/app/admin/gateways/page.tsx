"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug2, Activity } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatusBadge, Drawer, DetailRow } from "@/components/admin/ui";
import { GatewaysAdminApi, ApiError, type CreateGatewayInput } from "@/lib/admin/payments-api";

const HEALTH_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  ONLINE: { label: "Online", tone: "success" },
  DEGRADED: { label: "Degradado", tone: "warning" },
  OFFLINE: { label: "Offline", tone: "danger" },
};

const PROVIDERS = ["MOCK", "CARTPANDA", "CARTWAVEHUB", "MERCADO_PAGO", "PAY4FUN", "BSPAY", "PAY2M", "OPENPIX", "OUTROS"];

export default function AdminGatewaysPage() {
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "gateways"],
    queryFn: () => GatewaysAdminApi.list({ page: 1, pageSize: 100 }),
  });
  const gateways = data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gateways de Pagamento"
        description="Cada Gateway registrado pode ser usado no roteamento (single/round-robin/weighted/failover). Apenas MOCK é funcional nesta fase."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plug2 className="size-4" /> Conectar gateway
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)
          : gateways.map((g) => (
              <Card key={g.id} className="p-5 cursor-pointer" onClick={() => setSelectedId(g.id)}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{g.name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {g.provider} · {g.mode}
                    </p>
                  </div>
                  <StatusBadge tone={HEALTH_STATUS[g.latestHealthStatus ?? ""]?.tone ?? "danger"} pulse={g.latestHealthStatus === "ONLINE"}>
                    {HEALTH_STATUS[g.latestHealthStatus ?? ""]?.label ?? "Sem verificação"}
                  </StatusBadge>
                </div>

                <DetailRow label="Ativo" value={g.active ? "Sim" : "Não"} />
                <DetailRow label="Prioridade" value={String(g.priority)} />
                <DetailRow label="Peso" value={String(g.weight)} />
                {g.simulatedHealth && <DetailRow label="Saúde simulada" value={g.simulatedHealth} />}

                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setSelectedId(g.id); }}>
                    Configurar
                  </Button>
                </div>
              </Card>
            ))}
        {!isLoading && gateways.length === 0 && (
          <Card className="p-8 text-center text-sm text-text-muted md:col-span-2 xl:col-span-3">
            Nenhum gateway configurado. Clique em &quot;Conectar gateway&quot; para começar.
          </Card>
        )}
      </div>

      {creating && <GatewayFormDrawer onClose={() => setCreating(false)} />}
      {selectedId && <GatewayDetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function GatewayFormDrawer({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateGatewayInput>({
    name: "",
    provider: "MOCK",
    mode: "SANDBOX",
    webhookSecret: "",
    active: false,
    priority: 0,
    weight: 1,
    timeoutMs: 15000,
    maxRetries: 2,
  });

  const create = useMutation({
    mutationFn: () => GatewaysAdminApi.create(form),
    onSuccess: () => {
      toast.success("Gateway criado");
      queryClient.invalidateQueries({ queryKey: ["admin", "payments", "gateways"] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao criar gateway"),
  });

  return (
    <Drawer open onClose={onClose} title="Conectar gateway">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Nome</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Provedor</label>
          <select
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {form.provider !== "MOCK" && (
            <p className="mt-1 text-[11px] text-text-muted">
              Estrutura pronta, mas este provedor ainda não está implementado nesta fase.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Modo</label>
          <select
            value={form.mode}
            onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as "SANDBOX" | "PRODUCTION" }))}
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          >
            <option value="SANDBOX">Sandbox</option>
            <option value="PRODUCTION">Produção</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Segredo do webhook</label>
          <input
            required
            minLength={8}
            value={form.webhookSecret}
            onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
            placeholder="Mín. 8 caracteres — armazenado criptografado"
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60 font-mono"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Prioridade</label>
            <input
              type="number"
              min={0}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-2 text-sm outline-none focus:border-purple/60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Peso</label>
            <input
              type="number"
              min={1}
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
              className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-2 text-sm outline-none focus:border-purple/60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Timeout (ms)</label>
            <input
              type="number"
              min={1000}
              value={form.timeoutMs}
              onChange={(e) => setForm((f) => ({ ...f, timeoutMs: Number(e.target.value) }))}
              className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-2 text-sm outline-none focus:border-purple/60"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Ativo (disponível para roteamento imediatamente)
        </label>

        <Button type="submit" variant="primary" loading={create.isPending}>
          Criar gateway
        </Button>
        <p className="text-[11px] text-text-muted">
          Credenciais e segredo do webhook são armazenados com AES-256-GCM — nunca em texto puro.
        </p>
      </form>
    </Drawer>
  );
}

function GatewayDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "gateway", id],
    queryFn: () => GatewaysAdminApi.get(id),
  });
  const gateway = data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "payments", "gateway", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "payments", "gateways"] });
  };

  const toggleActive = useMutation({
    mutationFn: (active: boolean) => GatewaysAdminApi.update(id, { active }),
    onSuccess: () => {
      toast.success("Gateway atualizado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atualizar"),
  });

  const setSimulatedHealth = useMutation({
    mutationFn: (simulatedHealth: "ONLINE" | "DEGRADED" | "OFFLINE" | null) =>
      GatewaysAdminApi.update(id, { simulatedHealth }),
    onSuccess: () => {
      toast.success("Saúde simulada atualizada");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atualizar"),
  });

  const testConnection = useMutation({
    mutationFn: () => GatewaysAdminApi.testConnection(id),
    onSuccess: (res) => {
      toast.success(`Health check: ${res.data.status} (${res.data.latencyMs}ms)`);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha no teste de conexão"),
  });

  return (
    <Drawer open onClose={onClose} title={gateway ? gateway.name : "Carregando..."}>
      {isLoading || !gateway ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <DetailRow label="ID" value={<code className="text-xs">{gateway.id}</code>} />
            <DetailRow label="Provedor" value={gateway.provider} />
            <DetailRow label="Modo" value={gateway.mode} />
            <DetailRow label="Prioridade" value={String(gateway.priority)} />
            <DetailRow label="Peso" value={String(gateway.weight)} />
            <DetailRow label="Timeout" value={`${gateway.timeoutMs}ms`} />
            <DetailRow label="Máx. tentativas" value={String(gateway.maxRetries)} />
            <DetailRow
              label="Última verificação"
              value={
                gateway.latestHealthStatus
                  ? `${gateway.latestHealthStatus} (${gateway.latestHealthCheckedAt ? new Date(gateway.latestHealthCheckedAt).toLocaleString("pt-BR") : "—"})`
                  : "Nunca verificado"
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={gateway.active}
              onChange={(e) => toggleActive.mutate(e.target.checked)}
              disabled={toggleActive.isPending}
            />
            Ativo (disponível para roteamento)
          </label>

          <Button variant="secondary" size="sm" loading={testConnection.isPending} onClick={() => testConnection.mutate()}>
            <Activity className="size-4" /> Testar conexão
          </Button>

          {gateway.provider === "MOCK" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Saúde simulada (só para testes de failover)
              </label>
              <select
                value={gateway.simulatedHealth ?? ""}
                onChange={(e) =>
                  setSimulatedHealth.mutate(
                    e.target.value === "" ? null : (e.target.value as "ONLINE" | "DEGRADED" | "OFFLINE")
                  )
                }
                disabled={setSimulatedHealth.isPending}
                className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
              >
                <option value="">Real (sempre ONLINE)</option>
                <option value="ONLINE">Forçar ONLINE</option>
                <option value="DEGRADED">Forçar DEGRADED</option>
                <option value="OFFLINE">Forçar OFFLINE</option>
              </select>
            </div>
          )}

          <p className="text-[11px] text-text-muted">
            Credenciais e segredo do webhook nunca são exibidos aqui — apenas re-cadastrados via atualização.
          </p>
        </div>
      )}
    </Drawer>
  );
}
