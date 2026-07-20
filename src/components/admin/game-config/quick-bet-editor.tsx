"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

/** Add/edit/remove/reorder the quick-bet button row — values are cents. */
export function QuickBetEditor({
  amounts,
  onChange,
}: {
  amounts: number[];
  onChange: (amounts: number[]) => void;
}) {
  const [newValue, setNewValue] = useState("");

  const move = (index: number, dir: -1 | 1) => {
    const next = [...amounts];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => onChange(amounts.filter((_, i) => i !== index));

  const update = (index: number, cents: number) => {
    const next = [...amounts];
    next[index] = cents;
    onChange(next);
  };

  const add = () => {
    const reais = Number(newValue.replace(",", "."));
    if (!Number.isFinite(reais) || reais <= 0) return;
    onChange([...amounts, Math.round(reais * 100)]);
    setNewValue("");
  };

  return (
    <div className="flex flex-col gap-2">
      {amounts.map((cents, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.02] p-2">
          <span className="w-20 shrink-0 text-sm font-bold tabular-nums">{formatCurrency(cents / 100)}</span>
          <input
            type="number"
            step="1"
            min={1}
            value={(cents / 100).toFixed(2)}
            onChange={(e) => update(i, Math.round(Number(e.target.value) * 100))}
            className="h-8 w-24 rounded-lg border border-border bg-bg px-2 text-xs outline-none focus:border-purple/60"
          />
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
              disabled={i === amounts.length - 1}
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
