"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader, SectionCard } from "@/components/admin/ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IdentityAdminApi } from "@/lib/admin/identity-api";

const ALL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "OPERATOR",
  "MODERATOR",
  "SUPPORT",
  "COMPLIANCE",
  "AUDIT",
  "USER",
  "AFFILIATE",
] as const;

export default function AdminPermissionsPage() {
  const catalogQuery = useQuery({
    queryKey: ["admin", "permission-catalog"],
    queryFn: () => IdentityAdminApi.listPermissionCatalog(),
  });
  const grantsQuery = useQuery({
    queryKey: ["admin", "role-grants"],
    queryFn: () => IdentityAdminApi.listRoleGrants(),
  });

  const catalog = catalogQuery.data?.data ?? [];
  const grants = grantsQuery.data?.data ?? [];
  const grantsByRole = new Map(grants.map((g) => [g.role, new Set(g.permissions)]));
  const loading = catalogQuery.isLoading || grantsQuery.isLoading;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Permissões"
        description="Matriz de permissões independente de cargos (Permission/RolePermission) — SUPER_ADMIN sempre tem acesso total, por design."
      />

      <SectionCard title="Catálogo de permissões" description={`${catalog.length} chaves cadastradas`}>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {catalog.map((p) => (
              <div key={p.key} className="rounded-xl border border-border bg-white/[0.02] p-3">
                <code className="text-xs font-semibold text-purple">{p.key}</code>
                <p className="text-xs text-text-secondary mt-1">{p.description}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Matriz papel × permissão" description="Grants atuais por papel (RolePermission)">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Permissão
                  </th>
                  {ALL_ROLES.map((role) => (
                    <th
                      key={role}
                      className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                    >
                      {role === "SUPER_ADMIN" ? "SUPER" : role.slice(0, 4)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalog.map((p) => (
                  <tr key={p.key} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2">
                      <code className="text-xs">{p.key}</code>
                    </td>
                    {ALL_ROLES.map((role) => {
                      const granted = role === "SUPER_ADMIN" || grantsByRole.get(role)?.has(p.key);
                      return (
                        <td key={role} className="px-2 py-2 text-center">
                          <span
                            className={
                              granted
                                ? "inline-block size-2 rounded-full bg-green"
                                : "inline-block size-2 rounded-full bg-white/10"
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Card className="p-4">
        <p className="text-xs text-text-muted">
          SUPER_ADMIN ignora a matriz por design (ver <code>hasRole</code> em{" "}
          <code>src/server/auth/rbac.ts</code>) — a coluna acima reflete esse bypass, não uma linha
          extra em RolePermission. Edição da matriz via UI fica para uma fase futura; hoje os grants
          são definidos em <code>prisma/seed.ts</code>.
        </p>
      </Card>
    </div>
  );
}
