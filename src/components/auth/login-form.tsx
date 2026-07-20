"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginInput } from "@/lib/validation";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    setSubmitting(false);

    if (res?.error) {
      toast.error("Email ou senha incorretos");
      return;
    }

    toast.success("Bem-vindo de volta!");
    router.push(searchParams.get("callbackUrl") ?? "/home");
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

        <div className="flex justify-end -mt-2">
          <Link
            href="#"
            className="text-sm text-purple hover:text-pink transition-colors font-medium"
          >
            Esqueceu a senha?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" loading={submitting} className="mt-1">
          Entrar
        </Button>
      </form>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-muted">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="secondary"
        size="lg"
        loading={googleLoading}
        disabled={!googleEnabled}
        onClick={async () => {
          setGoogleLoading(true);
          await signIn("google", { callbackUrl: "/home" }).finally(() => setGoogleLoading(false));
        }}
      >
        <GoogleIcon />
        {googleEnabled ? "Continuar com Google" : "Google indisponível no momento"}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        Não tem conta?{" "}
        <Link
          href="/signup"
          className="text-purple font-semibold hover:text-pink transition-colors"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.94A9 9 0 000 9c0 1.45.35 2.83.94 4.03l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
