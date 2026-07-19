"use client";

import { useMemo, useState } from "react";
import { Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, FilterBar, FilterChips } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import { cn } from "@/lib/utils";

const LEVEL_STYLE = {
  debug: "text-text-muted",
  info: "text-[#7DD3FC]",
  warn: "text-warning",
  error: "text-error",
};

export default function AdminLogsPage() {
  const { data, loading } = useAdminData(AdminServices.logs);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");

  const rows = useMemo(() => {
    let out = data ?? [];
    if (level !== "all") out = out.filter((l) => l.level === level);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((l) => l.message.toLowerCase().includes(q) || l.service.includes(q));
    }
    return out;
  }, [data, search, level]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Logs"
        description="Stream unificado dos serviços. Na integração, este painel receberá eventos em tempo real via WebSocket."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={notImplemented}>
              <Pause className="size-4" /> Pausar stream
            </Button>
            <Button variant="ghost" size="sm" onClick={notImplemented} className="border border-border">
              <Trash2 className="size-4" /> Limpar
            </Button>
          </>
        }
      />

      <FilterBar search={search} onSearch={setSearch} placeholder="Filtrar mensagens...">
        <FilterChips
          value={level}
          onChange={setLevel}
          options={[
            { value: "all", label: "Todos" },
            { value: "error", label: "Errors" },
            { value: "warn", label: "Warnings" },
            { value: "info", label: "Info" },
            { value: "debug", label: "Debug" },
          ]}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto bg-black/40 p-4 font-mono text-[12.5px] leading-relaxed">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-text-muted">Nenhuma entrada corresponde aos filtros</p>
          ) : (
            rows.map((l) => (
              <div key={l.id} className="flex gap-3 whitespace-nowrap py-0.5 hover:bg-white/[0.03]">
                <span className="text-text-muted tabular-nums">{l.createdAt}</span>
                <span className={cn("w-12 shrink-0 font-bold uppercase", LEVEL_STYLE[l.level])}>{l.level}</span>
                <span className="w-32 shrink-0 text-purple">{l.service}</span>
                <span className="text-text-secondary">{l.message}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
