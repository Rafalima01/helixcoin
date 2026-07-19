import type { Metadata } from "next";
import { ShieldCheck, Banknote, Timer } from "lucide-react";
import { WithdrawPanel } from "@/components/wallet/withdraw-panel";

export const metadata: Metadata = { title: "Sacar — HeliJump" };

const FEATURES = [
  { icon: Banknote, title: "Via PIX", text: "Transferimos direto para a chave informada." },
  { icon: Timer, title: "Rápido", text: "Processamento em até alguns minutos." },
  { icon: ShieldCheck, title: "Verificado", text: "Saques auditados para sua segurança." },
];

export default function WithdrawPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Sacar</h1>
        <p className="text-text-secondary mt-1">
          Solicite seu saque e receba via PIX na chave informada.
        </p>
      </div>

      <WithdrawPanel />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass-card p-4 flex flex-col gap-1.5">
            <f.icon className="size-4 text-purple" />
            <p className="text-sm font-semibold">{f.title}</p>
            <p className="text-xs text-text-secondary leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
