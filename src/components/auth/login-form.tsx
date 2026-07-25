"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginInput } from "@/modules/identity/validators/auth.validator";

export function LoginForm({
  showSignupLink = true,
  fallbackPath = "/home",
}: {
  /** Admin/manager logins hide this — those roles are never self-registered. */
  showSignupLink?: boolean;
  /** Where to land when there's no `callbackUrl` (e.g. visiting /login directly instead of being redirected). */
  fallbackPath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { rememberMe: false } });

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(json?.error?.message ?? "Email ou senha incorretos");
      return;
    }

    toast.success("Bem-vindo de volta!");
    router.push(searchParams.get("callbackUrl") ?? fallbackPath);
    router.refresh();
  };

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
        <Input
          label="Senha"
          type="password"
          icon={Lock}
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex items-center justify-between -mt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-text-secondary">
            <input
              type="checkbox"
              className="size-4 rounded border-border bg-white/5 accent-purple"
              {...register("rememberMe")}
            />
            Lembrar de mim
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-purple hover:text-pink transition-colors font-medium"
          >
            Esqueceu a senha?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" loading={submitting} className="mt-1">
          Entrar
        </Button>
      </form>

      {showSignupLink && (
        <p className="text-center text-sm text-text-secondary">
          Não tem conta?{" "}
          <Link
            href={
              searchParams.get("callbackUrl")
                ? `/signup?callbackUrl=${encodeURIComponent(searchParams.get("callbackUrl")!)}`
                : "/signup"
            }
            className="text-purple font-semibold hover:text-pink transition-colors"
          >
            Criar conta
          </Link>
        </p>
      )}
    </div>
  );
}
