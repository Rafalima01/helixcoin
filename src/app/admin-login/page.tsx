import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Acesso Administrativo — HeliJump" };

/**
 * Reached only via admin.{domain} (see src/proxy.ts's host rewrite, which
 * maps that host's /login to this path). Deliberately OUTSIDE
 * src/app/admin/ — nesting it there would inherit admin/layout.tsx's
 * auth-redirect-to-/login and create an infinite loop (this page IS the
 * login target). Never shows the game hero/testimonial, never offers
 * self-signup — admins are provisioned directly, not self-registered.
 */
export default function AdminLoginPage() {
  return (
    <AuthShell title="Acesso Administrativo" subtitle="Entre com sua conta de administrador." hideHero>
      <Suspense fallback={null}>
        <LoginForm showSignupLink={false} fallbackPath="/" />
      </Suspense>
    </AuthShell>
  );
}
