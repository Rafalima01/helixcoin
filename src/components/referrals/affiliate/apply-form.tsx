"use client";

import { useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApplyAffiliate } from "@/hooks/use-affiliate";

/**
 * "Fluxo orgânico" vs. "fluxo via convite" (see AGENTS.md's "Painel do
 * Afiliado Integrado") share this exact same form — the only difference is
 * whether `managerCode` ends up set, which changes the sponsor/commission
 * resolved server-side, never the screen shown. `prefillManagerCode` comes
 * from the /referrals page reading `?manager=` off the URL (set by
 * /affiliate-invite/[code]/route.ts's redirect), not read here directly, so
 * there's a single Suspense boundary for the whole tab instead of one per
 * component.
 */
export function AffiliateApplyForm({ prefillManagerCode }: { prefillManagerCode?: string }) {
  const [managerCode, setManagerCode] = useState(prefillManagerCode?.toUpperCase() ?? "");
  const [pixKey, setPixKey] = useState("");
  const apply = useApplyAffiliate();

  const handleSubmit = async () => {
    try {
      await apply.mutateAsync({
        managerCode: managerCode.trim() || undefined,
        pixKey: pixKey.trim() || undefined,
      });
      toast.success("Solicitação enviada! Você será avisado assim que for avaliada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar solicitação");
    }
  };

  return (
    <Card glow="purple" className="p-6 md:p-8 bg-gradient-to-br from-purple/15 via-transparent to-pink/10">
      <div className="flex items-center gap-3 mb-5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-white">
          <Gift className="size-5" />
        </span>
        <div>
          <p className="font-bold text-lg leading-tight flex items-center gap-2">
            Participar do Programa de Afiliados <Sparkles className="size-4 text-warning" />
          </p>
          <p className="text-xs text-text-secondary">Ganhe comissões reais sobre sua rede.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-w-md">
        <Input
          label="Código do gerente (opcional)"
          placeholder="Ex: ABC12345"
          value={managerCode}
          onChange={(e) => setManagerCode(e.target.value.toUpperCase())}
          hint="Se você foi convidado por um gerente, informe o código dele aqui."
        />
        <Input
          label="Chave PIX (opcional)"
          placeholder="E-mail, CPF, telefone ou chave aleatória"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          hint="Pode ser preenchida depois, antes do primeiro saque."
        />
        <Button variant="primary" size="lg" onClick={handleSubmit} loading={apply.isPending}>
          Enviar solicitação
        </Button>
      </div>
    </Card>
  );
}
