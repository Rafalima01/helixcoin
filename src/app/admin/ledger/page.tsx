"use client";

import { useMemo, useState } from "react";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import type { LedgerEntryDTO } from "@/lib/admin/types";
import { formatCurrency, cn } from "@/lib/utils";

const TYPE_LABEL: Record<LedgerEntryDTO["type"], string> = {
  deposit: "Depósito",
  withdraw: "Saque",
  bet: "Aposta",
  payout: "Resgate",
  bonus: "Bônus",
  cashback: "Cashback",
  commission: "Comissão",
  adjustment: "Ajuste",
};

export default function AdminLedgerPage() {
  const { data, loading } = useAdminData(AdminServices.ledger);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const rows = useMemo(() => {
    let out = data ?? [];
    if (type !== "all") out = out.filter((l) => l.type === type);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((l) => l.userName.toLowerCase().includes(q) || l.reference.includes(q));
    }
    return out;
  }, [data, search, type]);

  const columns: TableColumn<LedgerEntryDTO>[] = [
    { key: "ref", header: "Referência", render: (l) => <code className="text-xs text-text-secondary">{l.reference}</code> },
    { key: "user", header: "Usuário", render: (l) => <span className="font-medium">{l.userName}</span> },
    { key: "type", header: "Tipo", render: (l) => <StatusBadge tone={l.amount >= 0 ? "success" : "neutral"}>{TYPE_LABEL[l.type]}</StatusBadge> },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      render: (l) => (
        <span className={cn("font-semibold tabular-nums", l.amount >= 0 ? "text-green" : "text-text")}>
          {l.amount >= 0 ? "+" : "−"}
          {formatCurrency(Math.abs(l.amount))}
        </span>
      ),
    },
    { key: "after", header: "Saldo após", align: "right", render: (l) => <span className="tabular-nums text-text-secondary">{formatCurrency(l.balanceAfter)}</span> },
    { key: "at", header: "Data/Hora", align: "right", render: (l) => <span className="text-xs text-text-muted tabular-nums">{l.createdAt}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ledger Financeiro"
        description="Livro-razão imutável de todas as movimentações. Cada lançamento terá dupla entrada e trilha de auditoria no Backend."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por usuário ou referência...">
        <FilterChips
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "Tudo" },
            { value: "deposit", label: "Depósitos" },
            { value: "withdraw", label: "Saques" },
            { value: "bet", label: "Apostas" },
            { value: "payout", label: "Resgates" },
            { value: "bonus", label: "Bônus" },
            { value: "commission", label: "Comissões" },
            { value: "adjustment", label: "Ajustes" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={loading} pageSize={10} />
    </div>
  );
}
