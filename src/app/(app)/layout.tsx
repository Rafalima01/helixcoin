import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuthContext();
  if (!auth) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
