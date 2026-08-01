import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Criar Conta — HeliJump" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Leva menos de um minuto. Sem cartão de crédito."
      banner={{ src: "/auth-banner-signup.webp", width: 1672, height: 941, alt: "HelixCoin" }}
      centered
    >
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
