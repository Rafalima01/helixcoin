"use client";

import { PlusCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { GameRowDTO } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";

const STATUS = {
  enabled: { label: "Habilitado", tone: "success" as const },
  disabled: { label: "Desabilitado", tone: "neutral" as const },
  maintenance: { label: "Manutenção", tone: "warning" as const },
};

export default function AdminGamesPage() {
  const { data, loading } = useAdminData(AdminServices.games);

  const columns: TableColumn<GameRowDTO>[] = [
    {
      key: "name",
      header: "Jogo",
      render: (g) => (
        <div className="flex items-center gap-2 min-w-0">
          {g.featured && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
          <div className="min-w-0">
            <p className="font-semibold truncate">{g.name}</p>
            <p className="text-xs text-text-muted truncate">{g.provider}</p>
          </div>
        </div>
      ),
    },
    { key: "cat", header: "Categoria", render: (g) => <span className="text-text-secondary text-xs">{g.category}</span> },
    { key: "status", header: "Status", render: (g) => <StatusBadge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</StatusBadge> },
    { key: "sessions", header: "Sessões (24h)", align: "right", render: (g) => <span className="tabular-nums">{g.sessions24h.toLocaleString("pt-BR")}</span> },
    { key: "ggr", header: "GGR (24h)", align: "right", render: (g) => <span className="font-semibold tabular-nums text-green">{g.ggr24h > 0 ? formatCurrency(g.ggr24h) : "—"}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: () => (
        <Button variant="ghost" size="sm" onClick={notImplemented} className="border border-border">
          Gerenciar
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Catálogo de Jogos"
        description="Títulos disponíveis na plataforma, destaque e disponibilidade."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <PlusCircle className="size-4" /> Adicionar jogo
          </Button>
        }
      />
      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
