import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Acesso do Gerente — HeliJump" };

/**
 * Reached only via manager.{domain} (see src/proxy.ts's host rewrite, which
 * maps that host's /login to this path). Deliberately OUTSIDE
 * src/app/manager/ — nesting it there would inherit manager/layout.tsx's
 * auth-redirect-to-/login and create an infinite loop (this page IS the
 * login target). Never shows the game hero/testimonial, never offers
 * self-signup — managers only exist via an admin-approved invite (see
 * ManagerInviteService), not self-registration.
 */
export default function ManagerLoginPage() {
  return (
    <AuthShell title="Acesso do Gerente" subtitle="Entre com sua conta de gerente." hideHero>
      <Suspense fallback={null}>
        <LoginForm showSignupLink={false} fallbackPath="/" />
      </Suspense>
    </AuthShell>
  );
}
