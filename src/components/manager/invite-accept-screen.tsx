"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, XCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import type { ManagerInvitePublicDto } from "@/modules/manager/dto/manager-invite.dto";

async function acceptInvite(
  token: string,
  data: { name: string; email: string; phone: string; password: string; confirmPassword: string }
) {
  const res = await fetch(`/api/manager-invites/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro ao aceitar convite");
  return json.data;
}

/**
 * "Cadastro de Gerente" (correção): o Admin não sabe quem é o candidato até
 * este formulário ser enviado — o link só carrega um token. O candidato
 * preenche a própria identidade aqui; o resultado é uma solicitação pendente
 * (não uma conta de gerente ativa) até um Admin aprovar em Solicitações.
 */
export function InviteAcceptScreen({
  token,
  invite,
  error,
}: {
  token: string;
  invite: ManagerInvitePublicDto | null;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (name.trim().length < 2) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (phone.trim().length < 8) {
      toast.error("Informe um telefone válido");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      await acceptInvite(token, { name: name.trim(), email: email.trim(), phone: phone.trim(), password, confirmPassword });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aceitar convite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 bg-app-radial">
      <Logo />

      {done ? (
        <Card glow="green" className="w-full max-w-md p-6 md:p-8 text-center flex flex-col items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-green/15 text-green">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="font-bold text-lg">Cadastro enviado para análise!</p>
          <p className="text-sm text-text-secondary">
            Sua conta foi criada e sua solicitação para se tornar gerente está com o Admin para aprovação. Você
            será avisado assim que ela for avaliada — enquanto isso, já pode fazer login normalmente.
          </p>
          <Link href="/login">
            <Button variant="primary" size="lg">
              Ir para o login
            </Button>
          </Link>
        </Card>
      ) : error || !invite ? (
        <Card className="w-full max-w-md p-6 md:p-8 text-center flex flex-col items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-error/15 text-error">
            <XCircle className="size-6" />
          </span>
          <p className="font-bold text-lg">Convite inválido</p>
          <p className="text-sm text-text-secondary">{error ?? "Este convite não é mais válido."}</p>
        </Card>
      ) : (
        <Card glow="purple" className="w-full max-w-md p-6 md:p-8 bg-gradient-to-br from-purple/15 via-transparent to-pink/10">
          <div className="flex items-center gap-3 mb-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-white">
              <Briefcase className="size-5" />
            </span>
            <div>
              <p className="font-bold text-lg leading-tight">Convite de Gerente</p>
              <p className="text-xs text-text-secondary">Preencha seus dados para concluir o cadastro.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Input label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo de 8 caracteres" />
            <Input label="Confirmar senha" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

            <Button variant="primary" size="lg" loading={loading} onClick={handleSubmit}>
              Enviar cadastro
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
