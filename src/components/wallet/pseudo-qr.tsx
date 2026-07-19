"use client";

import { createRng } from "@/lib/rng";

export function PseudoQr({ data, size = 200 }: { data: string; size?: number }) {
  const cells = 21;
  const rand = createRng(data);
  const grid: boolean[] = Array.from({ length: cells * cells }, () => rand() > 0.52);

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);

  return (
    <div
      className="bg-white rounded-xl p-3 shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label="QR Code PIX (demonstração)"
    >
      <div
        className="grid w-full h-full"
        style={{ gridTemplateColumns: `repeat(${cells}, 1fr)`, gridTemplateRows: `repeat(${cells}, 1fr)` }}
      >
        {grid.map((filled, i) => {
          const r = Math.floor(i / cells);
          const c = i % cells;
          const finder = isFinder(r, c);
          return (
            <div
              key={i}
              className={finder || filled ? "bg-[#0B0815]" : "bg-transparent"}
            />
          );
        })}
      </div>
    </div>
  );
}
