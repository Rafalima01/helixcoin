import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar — HeliJump" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre para continuar girando a torre."
      banner={{ src: "/auth-banner-login.webp", width: 1747, height: 900, alt: "HelixCoin" }}
      centered
    >
      <Suspense fallback={null}>
        <LoginForm submitVariant="gold" />
      </Suspense>
    </AuthShell>
  );
}
