import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth";
import { hasRole, ROLE_HIERARCHY } from "@/server/auth/rbac";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Backoffice — HeliJump",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuthContext();
  if (!auth || !hasRole(auth.role, ROLE_HIERARCHY)) redirect("/login");

  return <AdminShell>{children}</AdminShell>;
}
