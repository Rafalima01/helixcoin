"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangePassword } from "@/hooks/use-profile";

export function SecuritySection({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const changePassword = useChangePassword();

  const handleSubmit = async () => {
    if (next.length < 8) {
      toast.error("A nova senha deve ter ao menos 8 caracteres");
      return;
    }
    if (next !== confirm) {
      toast.error("A confirmação não confere com a nova senha");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      toast.success("Senha alterada com sucesso!");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar senha");
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <Card className="p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-purple/15 text-purple">
            <KeyRound className="size-4" />
          </span>
          <div>
            <p className="font-bold">Alterar senha</p>
            <p className="text-xs text-text-secondary">Use uma senha forte e única.</p>
          </div>
        </div>

        <Input
          label="Senha atual"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          label="Nova senha"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint="Mínimo de 8 caracteres"
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <Button
          variant="primary"
          size="lg"
          loading={changePassword.isPending}
          onClick={handleSubmit}
          disabled={!current || !next || !confirm}
        >
          Salvar nova senha
        </Button>
      </Card>

      <Card className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-green/15 text-green">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <p className="font-bold">Sua conta</p>
            <p className="text-xs text-text-secondary">Dados de acesso e proteção.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1">E-mail</p>
          <p className="text-sm font-semibold truncate">{email || "—"}</p>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Suas transações e partidas são protegidas e auditadas. Nunca compartilhe sua senha — nossa
          equipe jamais irá solicitá-la.
        </p>
      </Card>
    </div>
  );
}
