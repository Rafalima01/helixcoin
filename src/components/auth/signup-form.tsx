"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { User, Mail, Lock, Gift } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signupSchema, type SignupInput } from "@/lib/validation";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      referralCode: searchParams.get("ref") ?? "",
      terms: false,
    },
  });

  const onSubmit = async (data: SignupInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Não foi possível criar sua conta");
        setSubmitting(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInRes?.error) {
        toast.success("Conta criada! Faça login para continuar.");
        router.push("/login");
        return;
      }

      toast.success("Conta criada com sucesso!");
      router.push("/home");
      router.refresh();
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <Input
          label="Nome completo"
          icon={User}
          placeholder="Seu nome"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
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
          placeholder="Mínimo de 6 caracteres"
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

        <Button type="submit" variant="primary" size="lg" loading={submitting} className="mt-1">
          Criar Conta
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
