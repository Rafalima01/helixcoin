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
      centered
    >
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
