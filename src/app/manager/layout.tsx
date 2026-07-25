import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth";
import { managerContainer } from "@/modules/manager/container";
import { ManagerShell } from "@/components/manager/manager-shell";
import { Logo } from "@/components/ui/logo";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Portal do Gerente — HeliJump",
  robots: { index: false, follow: false },
};

/**
 * ManagerInviteService.accept() DOES promote User.role to "MANAGER" at
 * account-creation time (unlike affiliate approval) — but portal access is
 * additionally gated on ManagerProfile.status, which the invite's "Status
 * inicial" (Ativo/Pendente) sets at that same moment. PENDING blocks the
 * portal until an Admin activates the account (see manager.service.ts's
 * activateProfile / the admin Gerentes drawer's "Ativar acesso" button).
 */
export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuthContext();
  if (!auth || auth.role !== "MANAGER") redirect("/login");

  const profile = await managerContainer.managerService.getByUserId(auth.userId).catch(() => null);
  if (!profile || profile.status !== "ACTIVE") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 bg-app-radial">
        <Logo />
        <Card className="w-full max-w-md p-6 md:p-8 text-center flex flex-col items-center gap-3">
          <p className="font-bold text-lg">Acesso pendente de ativação</p>
          <p className="text-sm text-text-secondary">
            Sua conta de gerente foi criada, mas o acesso ao painel ainda depende da aprovação do Admin. Você será
            avisado assim que estiver liberado.
          </p>
        </Card>
      </div>
    );
  }

  return <ManagerShell>{children}</ManagerShell>;
}
