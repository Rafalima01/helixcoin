"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionCard, StatusBadge } from "@/components/admin/ui";
import { notImplemented } from "@/lib/admin/use-admin-data";

/** Platform settings — Phase 1 mockup, all fields read-only. */
export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Configurações"
        description="Parâmetros globais da plataforma. Nenhuma configuração crítica vive no Frontend — tudo será persistido e validado pelo Backend."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <Save className="size-4" /> Salvar
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Marca e plataforma">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome da plataforma" value="HeliJump" readOnly />
            <Input label="Domínio principal" value="helijump.gg" readOnly />
            <Input label="Moeda" value="BRL (R$)" readOnly />
            <Input label="Fuso horário" value="America/Sao_Paulo" readOnly />
          </div>
        </SectionCard>

        <SectionCard title="Limites financeiros">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Depósito mínimo" value="R$ 5,00" readOnly />
            <Input label="Saque mínimo" value="R$ 10,00" readOnly />
            <Input label="Saque máximo diário" value="R$ 20.000,00" readOnly />
            <Input label="Aprovação manual acima de" value="R$ 2.500,00" readOnly />
          </div>
        </SectionCard>

        <SectionCard
          title="Compliance & KYC"
          actions={<StatusBadge tone="success">Ativo</StatusBadge>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="KYC obrigatório a partir de" value="R$ 2.000,00 sacados" readOnly />
            <Input label="Idade mínima" value="18 anos" readOnly />
            <Input label="Países bloqueados" value="12 configurados" readOnly />
            <Input label="Limite de sessão diária" value="Desativado" readOnly />
          </div>
        </SectionCard>

        <SectionCard title="Aparência do app do jogador">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Tema" value="Dark (padrão)" readOnly />
            <Input label="Cor de destaque" value="#8B5CF6" readOnly />
            <Input label="Ticker de vitórias" value="Ativado" readOnly />
            <Input label="Jogadores online (widget)" value="Ativado" readOnly />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
