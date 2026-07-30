"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, AtSign, Mail, Lock, Gift } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { registerSchema } from "@/modules/identity/validators/auth.validator";

const signupFormSchema = registerSchema.extend({
  terms: z.boolean().refine((v) => v === true, {
    message: "Você precisa aceitar os termos para continuar",
  }),
});

type SignupFormInput = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormInput>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      referralCode: searchParams.get("ref") ?? "",
      affiliateLinkSlug: searchParams.get("l") ?? "",
      terms: false,
    },
  });

  const onSubmit = async (data: SignupFormInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          username: data.username,
          email: data.email,
          password: data.password,
          referralCode: data.referralCode,
          affiliateLinkSlug: data.affiliateLinkSlug,
          source: searchParams.get("source") === "demo" ? "demo" : undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? "Não foi possível criar sua conta");
        setSubmitting(false);
        return;
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const callbackUrl = searchParams.get("callbackUrl");

      if (!loginRes.ok) {
        toast.success("Conta criada! Faça login para continuar.");
        router.push(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
        return;
      }

      toast.success("Conta criada com sucesso!");
      router.push(callbackUrl ?? "/home");
      router.refresh();
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nome"
            icon={User}
            placeholder="Seu nome"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <Input
            label="Sobrenome"
            placeholder="Seu sobrenome"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>
        <Input
          label="Username"
          icon={AtSign}
          placeholder="seu_username"
          autoComplete="username"
          error={errors.username?.message}
          {...register("username")}
        />
        <Input
          label="Email"
          type="email"
          icon={Mail}
          placeholder="voce@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Senha"
          type="password"
          icon={Lock}
          placeholder="Mínimo de 8 caracteres"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Código de indicação (opcional)"
          icon={Gift}
          placeholder="Ex: AMIGO2026"
          error={errors.referralCode?.message}
          {...register("referralCode")}
        />

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-border bg-white/5 accent-purple"
            {...register("terms")}
          />
          <span className="text-sm text-text-secondary leading-relaxed">
            Confirmo que sou maior de 18 anos e aceito os{" "}
            <Link href="#" className="text-purple hover:text-pink transition-colors">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="#" className="text-purple hover:text-pink transition-colors">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>
        {errors.terms?.message && (
          <span className="text-xs text-error font-medium -mt-3">{errors.terms.message}</span>
        )}

        <Button type="submit" variant="gold" size="lg" loading={submitting} className="mt-1">
          Criar Conta Grátis
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Já tem conta?{" "}
        <Link href="/login" className="text-purple font-semibold hover:text-pink transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  );
}
