"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { confirmPasswordResetSchema } from "@/modules/identity/validators/password.validator";
import type { z } from "zod";

type FormInput = z.infer<typeof confirmPasswordResetSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(confirmPasswordResetSchema),
    defaultValues: { token },
  });

  const onSubmit = async (data: FormInput) => {
    setSubmitting(true);
    const res = await fetch("/api/auth/password/reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(json?.error?.message ?? "Token inválido ou expirado");
      return;
    }

    toast.success("Senha redefinida! Faça login com sua nova senha.");
    router.push("/login");
  };

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-error">
          Link inválido ou incompleto. Solicite uma nova redefinição de senha.
        </p>
        <Link href="/forgot-password" className="text-sm text-purple font-semibold hover:text-pink transition-colors">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <input type="hidden" {...register("token")} />
        <Input
          label="Nova senha"
          type="password"
          icon={Lock}
          placeholder="Mínimo de 8 caracteres"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          icon={Lock}
          placeholder="Repita a nova senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" variant="primary" size="lg" loading={submitting}>
          Redefinir senha
        </Button>
      </form>
    </div>
  );
}
