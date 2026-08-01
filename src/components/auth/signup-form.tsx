"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Lock, CreditCard, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { registerSchema } from "@/modules/identity/validators/auth.validator";
import { onlyDigits } from "@/lib/cpf";
import { formatPhone } from "@/lib/phone";

function formatCpf(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

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
    setValue,
    formState: { errors },
  } = useForm<SignupFormInput>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      // No visible field for these — they're only ever set via a referral
      // link's query params (?ref=/?l=), never typed by the player, per the
      // decluttered signup (nome/sobrenome/telefone/cpf/senha only).
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
          phone: data.phone,
          password: data.password,
          cpf: data.cpf,
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

      // Phone is the player's login identifier (see AuthService.login()) —
      // username/email no longer exist from the player's perspective.
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.phone, password: data.password }),
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
          label="Número"
          icon={Phone}
          placeholder="(11) 91234-5678"
          inputMode="numeric"
          maxLength={15}
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
          onChange={(e) => setValue("phone", formatPhone(e.target.value), { shouldValidate: false })}
        />
        <Input
          label="CPF"
          icon={CreditCard}
          placeholder="000.000.000-00"
          inputMode="numeric"
          maxLength={14}
          autoComplete="off"
          error={errors.cpf?.message}
          {...register("cpf")}
          onChange={(e) => setValue("cpf", formatCpf(e.target.value), { shouldValidate: false })}
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
