import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Backoffice — HeliJump",
  robots: { index: false, follow: false },
};

/**
 * Backoffice layout. Phase 1 is a navigable mockup — definitive authentication
 * and RBAC middleware will guard this segment in a later phase.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
