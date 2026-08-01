"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import type { DepositQuickAmountDto } from "@/modules/promotions/dto/promotions.dto";

/** Add/edit/remove/reorder/enable + "quente" highlight — same interaction model as QuickBetEditor (src/components/admin/game-config/quick-bet-editor.tsx), extended with per-item enabled/highlight fields. Values are cents. */
export function DepositQuickAmountEditor({
  items,
  onChange,
}: {
  items: DepositQuickAmountDto[];
  onChange: (items: DepositQuickAmountDto[]) => void;
}) {
  const [newValue, setNewValue] = useState("");

  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  const patch = (index: number, changes: Partial<DepositQuickAmountDto>) => {
    const next = [...items];
    next[index] = { ...next[index], ...changes };
    onChange(next);
  };

  const add = () => {
    const reais = Number(newValue.replace(",", "."));
    if (!Number.isFinite(reais) || reais <= 0) return;
    const amountCents = Math.round(reais * 100);
    if (items.some((i) => i.amountCents === amountCents)) return; // no duplicates
    onChange([...items, { amountCents, enabled: true, highlightEnabled: false, highlightLabel: null }]);
    setNewValue("");
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-2 transition-colors",
            item.highlightEnabled ? "border-gold/40 bg-gold/5" : "border-border bg-white/[0.02]"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-sm font-bold tabular-nums">{formatCurrency(item.amountCents / 100)}</span>
            <input
              type="number"
              step="1"
              min={1}
              value={(item.amountCents / 100).toFixed(2)}
              onChange={(e) => patch(i, { amountCents: Math.round(Number(e.target.value) * 100) })}
              className="h-8 w-24 rounded-lg border border-border bg-bg px-2 text-xs outline-none focus:border-purple/60"
            />
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(e) => patch(i, { enabled: e.target.checked })}
                className="size-3.5 accent-purple"
              />
              Ativo
            </label>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="flex size-7 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:text-white disabled:opacity-30"
                aria-label="Mover para cima"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="flex size-7 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:text-white disabled:opacity-30"
                aria-label="Mover para baixo"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex size-7 items-center justify-center rounded-lg border border-error/30 text-error transition-colors hover:bg-error/10"
                aria-label="Remover"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-[88px]">
            <label className="flex items-center gap-1.5 text-xs text-gold">
              <input
                type="checkbox"
                checked={item.highlightEnabled}
                onChange={(e) => patch(i, { highlightEnabled: e.target.checked })}
                className="size-3.5 accent-gold"
              />
              <Flame className="size-3.5" /> Destaque
            </label>
            {item.highlightEnabled && (
              <input
                type="text"
                maxLength={40}
                placeholder="Quente"
                value={item.highlightLabel ?? ""}
                onChange={(e) => patch(i, { highlightLabel: e.target.value || null })}
                className="h-7 w-40 rounded-lg border border-gold/30 bg-bg px-2 text-xs outline-none focus:border-gold/60"
              />
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min={0}
          placeholder="Novo valor (R$)"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="h-9 w-40 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-purple/60"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
