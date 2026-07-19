"use client";

import { FileBarChart, FileSpreadsheet, FileText, Download, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, DataTable, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { notImplemented } from "@/lib/admin/use-admin-data";

const REPORTS = [
  { icon: FileBarChart, title: "Financeiro diário", desc: "GGR, NGR, depósitos, saques e custos por dia." },
  { icon: FileSpreadsheet, title: "Jogadores", desc: "Base completa com KYC, saldos e atividade." },
  { icon: FileText, title: "Afiliados", desc: "Comissões, CPA e RevShare por rede." },
  { icon: FileBarChart, title: "Partidas", desc: "Todas as rodadas com multiplicadores e metas." },
  { icon: FileSpreadsheet, title: "Compliance", desc: "Transações acima de limites regulatórios." },
  { icon: FileText, title: "Gateways", desc: "Conciliação por provedor e taxa de sucesso." },
];

interface ExportRow {
  id: string;
  name: string;
  period: string;
  requestedBy: string;
  status: "ready" | "processing";
  size: string;
}

const EXPORTS: ExportRow[] = [
  { id: "ex_1", name: "Financeiro diário", period: "01/07 – 18/07", requestedBy: "Carla Nunes", status: "ready", size: "2,4 MB" },
  { id: "ex_2", name: "Afiliados", period: "Junho/2026", requestedBy: "Aline Barros", status: "ready", size: "890 KB" },
  { id: "ex_3", name: "Partidas", period: "19/07", requestedBy: "Rafael Lima", status: "processing", size: "—" },
];

const columns: TableColumn<ExportRow>[] = [
  { key: "name", header: "Relatório", render: (r) => <span className="font-semibold">{r.name}</span> },
  { key: "period", header: "Período", render: (r) => <span className="text-xs text-text-secondary tabular-nums">{r.period}</span> },
  { key: "by", header: "Solicitado por", render: (r) => <span className="text-text-secondary">{r.requestedBy}</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge tone={r.status === "ready" ? "success" : "info"}>{r.status === "ready" ? "Pronto" : "Processando"}</StatusBadge> },
  {
    key: "dl",
    header: "",
    align: "right",
    render: (r) => (
      <Button variant="ghost" size="sm" onClick={notImplemented} disabled={r.status !== "ready"} className="border border-border">
        <Download className="size-3.5" /> {r.size}
      </Button>
    ),
  },
];

export default function AdminReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Relatórios"
        description="Exportações sob demanda e agendadas. A geração ocorrerá em filas assíncronas no Backend."
        actions={
          <Button variant="secondary" size="sm" onClick={notImplemented}>
            <CalendarRange className="size-4" /> Agendar relatório
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORTS.map((r) => (
          <Card key={r.title} className="p-5 flex flex-col gap-2">
            <r.icon className="size-4 text-purple" />
            <p className="font-bold text-sm">{r.title}</p>
            <p className="text-xs text-text-secondary leading-relaxed flex-1">{r.desc}</p>
            <Button variant="secondary" size="sm" onClick={notImplemented} className="mt-2 self-start">
              <Download className="size-3.5" /> Exportar
            </Button>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-bold mb-3">Exportações recentes</h2>
        <DataTable columns={columns} rows={EXPORTS} />
      </div>
    </div>
  );
}
