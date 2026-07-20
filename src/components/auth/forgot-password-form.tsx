"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordResetSchema } from "@/modules/identity/validators/password.validator";
import type { z } from "zod";

type FormInput = z.infer<typeof requestPasswordResetSchema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(requestPasswordResetSchema) });

  const onSubmit = async (data: FormInput) => {
    setSubmitting(true);
    const res = await fetch("/api/auth/password/reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error("Não foi possível processar sua solicitação. Tente novamente.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-text-secondary leading-relaxed">
          Se existir uma conta com esse email, enviamos um link de redefinição de senha. Verifique
          sua caixa de entrada (e o spam).
        </p>
        <Link href="/login" className="text-sm text-purple font-semibold hover:text-pink transition-colors">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <Input
          label="Email"
          type="email"
          icon={Mail}
          placeholder="voce@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" variant="primary" size="lg" loading={submitting}>
          Enviar link de redefinição
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Lembrou a senha?{" "}
        <Link href="/login" className="text-purple font-semibold hover:text-pink transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  );
}
