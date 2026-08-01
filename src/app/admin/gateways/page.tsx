"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug2, Activity, ScrollText } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatusBadge, Drawer, DetailRow } from "@/components/admin/ui";
import { GatewaysAdminApi, PaymentSettingsAdminApi, ApiError, type CreateGatewayInput } from "@/lib/admin/payments-api";
import type { GatewayCredentialAdminDto } from "@/modules/payments/dto/payments.dto";

const HEALTH_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  ONLINE: { label: "Online", tone: "success" },
  DEGRADED: { label: "Degradado", tone: "warning" },
  OFFLINE: { label: "Offline", tone: "danger" },
};

const SIMULATED_FAULT_LABEL: Record<string, string> = {
  TIMEOUT: "Timeout",
  ERROR_500: "Erro 500",
  AUTH_ERROR: "Erro de autenticação",
  OFFLINE_CALLS: "Offline nas chamadas",
};

const PROVIDERS = [
  "MOCK",
  "VEOPAG",
  "AMPLOPAY",
  "CARTPANDA",
  "CARTWAVEHUB",
  "MERCADO_PAGO",
  "PAY4FUN",
  "BSPAY",
  "PAY2M",
  "OPENPIX",
  "OUTROS",
];

/** Providers with a real PaymentProvider implementation — the rest resolve to NotImplementedProvider (see provider.factory.ts). */
const IMPLEMENTED_PROVIDERS = new Set(["MOCK", "VEOPAG", "AMPLOPAY"]);

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

      <RoutingSettingsPanel gateways={gateways} />

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

function RoutingSettingsPanel({ gateways }: { gateways: { id: string; name: string }[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "settings"],
    queryFn: () => PaymentSettingsAdminApi.get(),
  });
  const settings = data?.data;

  if (isLoading || !settings) return <Skeleton className="h-24 w-full rounded-2xl" />;

  // Remounts (via key) after a successful save instead of syncing local state
  // from the query in an effect — same pattern as affiliate-settings/page.tsx.
  return <RoutingSettingsForm key={settings.updatedAt} settings={settings} gateways={gateways} />;
}

function RoutingSettingsForm({
  settings,
  gateways,
}: {
  settings: { routingMode: string; defaultGatewayCredentialId: string | null };
  gateways: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [routingMode, setRoutingMode] = useState(settings.routingMode);
  const [defaultGatewayCredentialId, setDefaultGatewayCredentialId] = useState(settings.defaultGatewayCredentialId ?? "");

  const save = useMutation({
    mutationFn: () =>
      PaymentSettingsAdminApi.update({
        routingMode: routingMode as "SINGLE" | "ROUND_ROBIN" | "WEIGHTED" | "FAILOVER",
        defaultGatewayCredentialId: defaultGatewayCredentialId || null,
      }),
    onSuccess: () => {
      toast.success("Roteamento atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin", "payments", "settings"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atualizar roteamento"),
  });

  return (
    <Card className="p-5">
      <p className="mb-3 font-bold">Roteamento entre gateways</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Modo de roteamento</label>
          <select
            value={routingMode}
            onChange={(e) => setRoutingMode(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          >
            <option value="SINGLE">Único (default fixo)</option>
            <option value="FAILOVER">Failover (por prioridade)</option>
            <option value="ROUND_ROBIN">Round-robin</option>
            <option value="WEIGHTED">Ponderado (por peso)</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Gateway padrão (modo Único)</label>
          <select
            value={defaultGatewayCredentialId}
            onChange={(e) => setDefaultGatewayCredentialId(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          >
            <option value="">Nenhum (primeiro ativo)</option>
            {gateways.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          Salvar
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-text-muted">
        Válido mesmo sem gateways reais — SINGLE/FAILOVER/ROUND_ROBIN/WEIGHTED já são exercitados hoje só com credenciais MOCK.
      </p>
    </Card>
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
  const [baseUrl, setBaseUrl] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const credentials: Record<string, unknown> = {};
      if (baseUrl) credentials.baseUrl = baseUrl;
      if (publicKey) credentials.publicKey = publicKey;
      if (privateKey) credentials.privateKey = privateKey;
      return GatewaysAdminApi.create({ ...form, credentials });
    },
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
          {!IMPLEMENTED_PROVIDERS.has(form.provider) && (
            <p className="mt-1 text-[11px] text-text-muted">
              Estrutura pronta, mas este provedor ainda não está implementado nesta fase.
            </p>
          )}
          {form.provider === "VEOPAG" && (
            <p className="mt-1 text-[11px] text-text-muted">
              Use Chave pública para o <code>client_id</code> e Chave privada para o <code>client_secret</code> —
              gerados em dashboard.veopag.com/credentials. URL Base não é necessária (fixa em api.veopag.com).
            </p>
          )}
          {form.provider === "AMPLOPAY" && (
            <p className="mt-1 text-[11px] text-text-muted">
              Use Chave pública para <code>x-public-key</code> e Chave privada para <code>x-secret-key</code> —
              gerados em app.amplopay.com (Integrações &gt; API). Saques exigem que o suporte da AmploPay ative o
              módulo de transferências e que o IP deste servidor esteja cadastrado no painel deles.
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
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">URL Base</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.provedor.com"
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60 font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Chave pública</label>
            <input
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60 font-mono"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Chave privada</label>
            <input
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60 font-mono"
            />
          </div>
        </div>
        <p className="-mt-2 text-[11px] text-text-muted">
          Chaves e URL base são armazenadas dentro do mesmo blob de credenciais AES-256-GCM — nenhum gateway tem colunas fixas, cada um usa só as chaves que precisa.
        </p>

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
          {form.provider === "AMPLOPAY" && (
            <p className="mt-1 text-[11px] text-text-muted">
              A AmploPay não assina webhooks por header — cadastre um webhook interno no painel deles
              (Configurações &gt; Webhooks) para os eventos de Transação e Transferência apontando para{" "}
              <code>/api/payments/webhook/AMPLOPAY</code> e cole aqui o token exclusivo gerado nessa tela.
            </p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Máx. tentativas</label>
            <input
              type="number"
              min={0}
              max={10}
              value={form.maxRetries}
              onChange={(e) => setForm((f) => ({ ...f, maxRetries: Number(e.target.value) }))}
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
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "gateway", id],
    queryFn: () => GatewaysAdminApi.get(id),
  });
  const gateway = data?.data;

  return (
    <Drawer open onClose={onClose} title={gateway ? gateway.name : "Carregando..."}>
      {isLoading || !gateway ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        // Remounts (via key) after any save invalidates the query, instead of
        // syncing local editable state from the fetch in an effect.
        <GatewayDetailContent key={gateway.updatedAt} id={id} gateway={gateway} />
      )}
    </Drawer>
  );
}

function GatewayDetailContent({ id, gateway }: { id: string; gateway: GatewayCredentialAdminDto }) {
  const queryClient = useQueryClient();

  const [priority, setPriority] = useState(gateway.priority);
  const [weight, setWeight] = useState(gateway.weight);
  const [timeoutMs, setTimeoutMs] = useState(gateway.timeoutMs);
  const [maxRetries, setMaxRetries] = useState(gateway.maxRetries);

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

  const saveRouting = useMutation({
    mutationFn: () => GatewaysAdminApi.update(id, { priority, weight, timeoutMs, maxRetries }),
    onSuccess: () => {
      toast.success("Configuração de roteamento atualizada");
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

  const setSimulatedErrorMode = useMutation({
    mutationFn: (simulatedErrorMode: "TIMEOUT" | "ERROR_500" | "AUTH_ERROR" | "OFFLINE_CALLS" | null) =>
      GatewaysAdminApi.update(id, { simulatedErrorMode }),
    onSuccess: () => {
      toast.success("Modo de falha simulado atualizado");
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
    <div className="flex flex-col gap-4">
      <div>
        <DetailRow label="ID" value={<code className="text-xs">{gateway.id}</code>} />
        <DetailRow label="Provedor" value={gateway.provider} />
        <DetailRow label="Modo" value={gateway.mode} />
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

      <div>
        <p className="mb-1.5 text-sm font-medium text-text-secondary">Prioridade, peso e resiliência</p>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Prioridade</label>
            <input
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-2 text-sm outline-none focus:border-purple/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Peso</label>
            <input
              type="number"
              min={1}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-2 text-sm outline-none focus:border-purple/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Timeout (ms)</label>
            <input
              type="number"
              min={1000}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-2 text-sm outline-none focus:border-purple/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Retries</label>
            <input
              type="number"
              min={0}
              max={10}
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-border bg-white/[0.03] px-2 text-sm outline-none focus:border-purple/60"
            />
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          loading={saveRouting.isPending}
          onClick={() => saveRouting.mutate()}
        >
          Salvar
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" loading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <Activity className="size-4" /> Testar conexão
        </Button>
        <Link href={`/payment-logs?gatewayCredentialId=${id}`}>
          <Button variant="secondary" size="sm" type="button">
            <ScrollText className="size-4" /> Ver logs
          </Button>
        </Link>
      </div>

      {gateway.provider === "MOCK" && (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Saúde simulada (health check — só para testes de failover)
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

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Modo de falha simulado (afeta as chamadas de verdade — depósito/saque)
            </label>
            <select
              value={gateway.simulatedErrorMode ?? ""}
              onChange={(e) =>
                setSimulatedErrorMode.mutate(
                  e.target.value === ""
                    ? null
                    : (e.target.value as "TIMEOUT" | "ERROR_500" | "AUTH_ERROR" | "OFFLINE_CALLS")
                )
              }
              disabled={setSimulatedErrorMode.isPending}
              className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
            >
              <option value="">Nenhum (chamadas normais)</option>
              {Object.entries(SIMULATED_FAULT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-muted">
              Diferente da saúde simulada: isso faz o depósito/saque falhar (ou atrasar, no caso de Timeout) de
              verdade, exercitando retry/timeout/failover reais do PaymentService.
            </p>
          </div>
        </>
      )}

      <p className="text-[11px] text-text-muted">
        Credenciais e segredo do webhook nunca são exibidos aqui — apenas re-cadastrados via atualização.
      </p>
    </div>
  );
}
