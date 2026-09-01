import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type ResultCardProps = {
  /** true = vitória, false = derrota */
  won: boolean;
  /** valor real ganho (0 ou negativo em derrota), já calculado pelo sistema */
  prizeAmount: number;
  /** saldo já atualizado pelo sistema */
  newBalance: number;
  /** dados opcionais existentes no estado atual */
  betAmount?: number;
  multiplier?: number;
  target?: string | number;
  cashedOut?: boolean;
  /** ações existentes — não alterar o fluxo */
  onPlayAgain: () => void;
  onExit: () => void;
  className?: string;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 7) * 0.35}s`,
        duration: `${3 + ((i * 13) % 20) / 10}s`,
        color: `var(--confetti-${(i % 5) + 1})`,
        rotate: `${(i * 47) % 360}deg`,
        size: 6 + ((i * 5) % 7),
      })),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

export function ResultCard({
  won,
  prizeAmount,
  newBalance,
  betAmount,
  multiplier,
  target,
  cashedOut,
  onPlayAgain,
  onExit,
  className,
}: ResultCardProps) {
  const details = [
    betAmount !== undefined ? { label: "Aposta", value: brl(betAmount) } : null,
    multiplier !== undefined ? { label: "Multiplicador", value: `${multiplier}x` } : null,
    target !== undefined ? { label: "Objetivo", value: String(target) } : null,
    cashedOut !== undefined
      ? { label: "Resgate", value: cashedOut ? "Resgatado" : "Não resgatado" }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={won ? "Você ganhou" : "Você perdeu"}
      className={cn(
        "result-card-enter helix-card relative mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem]",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-b-[2rem] px-6 pb-8 pt-9 text-center",
          won ? "helix-header-win" : "helix-header-lose",
        )}
      >
        {won && <Confetti />}
        <span
          aria-hidden
          className={cn(
            "relative mx-auto mb-4 block h-1 w-16 rounded-full",
            won ? "bg-helix-neon shadow-[0_0_18px_2px_var(--helix-neon)]" : "bg-helix-coral/70",
          )}
        />
        <h2
          className={cn(
            "relative text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl",
            won ? "helix-title-win" : "text-helix-text",
          )}
        >
          {won ? "Você ganhou!" : "Não foi dessa vez"}
        </h2>
        <p className="relative mt-2 text-sm font-medium text-helix-muted">
          {won
            ? `Parabéns! Você levou ${brl(prizeAmount)}.`
            : "A partida terminou. Tente a sorte novamente!"}
        </p>
      </div>

      <div className="px-6 pb-6 pt-6 text-center">
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.28em]",
            won ? "text-helix-cyan" : "text-helix-muted",
          )}
        >
          {won ? "Seu prêmio" : "Resultado"}
        </p>

        <div
          className={cn(
            "mx-auto mt-3 flex min-h-16 w-full items-center justify-center rounded-2xl px-5 py-4",
            won ? "helix-prize-win" : "helix-prize-lose",
          )}
        >
          <span
            className={cn(
              "text-3xl font-black tabular-nums tracking-tight sm:text-4xl",
              won ? "helix-neon-text" : "text-helix-text",
            )}
          >
            {won ? `+ ${brl(prizeAmount)}` : brl(prizeAmount)}
          </span>
        </div>

        <p className="mt-4 text-sm font-semibold text-helix-muted">
          Novo saldo:{" "}
          <span className="tabular-nums font-bold text-helix-text">{brl(newBalance)}</span>
        </p>

        {details.length > 0 && (
          <dl className="helix-panel mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl px-4 py-3 text-left">
            {details.map((d) => (
              <div key={d.label} className="flex flex-col">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-helix-muted">
                  {d.label}
                </dt>
                <dd className="text-sm font-bold tabular-nums text-helix-text">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="helix-cta w-full rounded-2xl px-6 py-4 text-base font-black uppercase tracking-wide transition-transform active:scale-[0.98]"
          >
            Jogar novamente
          </button>
          <button
            type="button"
            onClick={onExit}
            className="helix-secondary w-full rounded-2xl px-6 py-3.5 text-base font-bold transition-opacity hover:opacity-90"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultCard;
