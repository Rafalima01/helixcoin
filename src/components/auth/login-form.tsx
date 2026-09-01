"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginSchema, phoneLoginSchema, type LoginInput } from "@/modules/identity/validators/auth.validator";
import { formatPhone } from "@/lib/phone";

export function LoginForm({
  showSignupLink = true,
  fallbackPath = "/home",
  submitVariant = "primary",
  identityMode = "email",
}: {
  /** Admin/manager logins hide this — those roles are never self-registered. */
  showSignupLink?: boolean;
  /** Where to land when there's no `callbackUrl` (e.g. visiting /login directly instead of being redirected). */
  fallbackPath?: string;
  /** "gold" is the player-facing identity (hero/cadastro CTA tone) — admin/manager logins never pass this, so they keep the neutral "primary" look. */
  submitVariant?: "primary" | "gold";
  /**
   * "phone" is the player zone (phone is the login identifier — see
   * AuthService.login()'s phone branch): swaps the field's label/icon/mask
   * to match and hides "Esqueceu a senha?" (phone-only accounts have no
   * email for self-service reset, see password.service.ts's requestReset,
   * which is email-only). Admin/manager never pass this, so they keep
   * today's email copy. A string (not a component/function prop) because
   * this form is a Client Component rendered from Server Component pages
   * (e.g. /login) — passing functions across that boundary isn't allowed.
   */
  identityMode?: "email" | "phone";
}) {
  const isPhone = identityMode === "phone";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(isPhone ? phoneLoginSchema : loginSchema),
    defaultValues: { rememberMe: false },
  });

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
      toast.error(json?.error?.message ?? (isPhone ? "Telefone ou senha incorretos" : "Email ou senha incorretos"));
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
          label={isPhone ? "Número" : "Email ou Login"}
          type="text"
          icon={isPhone ? Phone : Mail}
          placeholder={isPhone ? "(11) 91234-5678" : "voce@email.com"}
          inputMode={isPhone ? "numeric" : undefined}
          maxLength={isPhone ? 15 : undefined}
          autoComplete={isPhone ? "tel" : "username"}
          error={errors.email?.message}
          {...register("email")}
          {...(isPhone
            ? { onChange: (e) => setValue("email", formatPhone(e.target.value), { shouldValidate: false }) }
            : {})}
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
          {!isPhone && (
            <Link
              href="/forgot-password"
              className="text-sm text-purple hover:text-pink transition-colors font-medium"
            >
              Esqueceu a senha?
            </Link>
          )}
        </div>

        <Button type="submit" variant={submitVariant} size="lg" loading={submitting} className="mt-1">
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
