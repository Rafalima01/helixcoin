import type { Metadata } from "next";
import { ShieldCheck, Zap, Clock } from "lucide-react";
import { DepositPanel } from "@/components/wallet/deposit-panel";

export const metadata: Metadata = { title: "Depositar — HeliJump" };

const FEATURES = [
  { icon: Zap, title: "Instantâneo", text: "Saldo creditado em segundos via PIX." },
  { icon: ShieldCheck, title: "Seguro", text: "Transações protegidas de ponta a ponta." },
  { icon: Clock, title: "24/7", text: "Deposite a qualquer hora, todos os dias." },
];

export default function DepositPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Depositar</h1>
        <p className="text-text-secondary mt-1">Adicione saldo instantaneamente via PIX.</p>
      </div>

      <DepositPanel />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass-card p-4 flex flex-col gap-1.5">
            <f.icon className="size-4 text-green" />
            <p className="text-sm font-semibold">{f.title}</p>
            <p className="text-xs text-text-secondary leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
