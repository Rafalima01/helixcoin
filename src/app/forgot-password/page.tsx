import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha — HeliJump" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Esqueceu a senha?" subtitle="Informe seu email para receber o link de redefinição.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
