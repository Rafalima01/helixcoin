"use client";

import { Clock, FileWarning, XCircle, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AffiliateMyProfileDto } from "@/modules/affiliate/dto/affiliate.dto";

const STATUS_CONTENT: Record<string, { icon: typeof Clock; title: string; tone: "purple" | "warning" | "error" }> = {
  PENDING: { icon: Clock, title: "Sua solicitação está em análise", tone: "purple" },
  DOCUMENTS_REQUESTED: { icon: FileWarning, title: "Documentos pendentes", tone: "warning" },
  REJECTED: { icon: XCircle, title: "Solicitação recusada", tone: "error" },
  BLOCKED: { icon: ShieldAlert, title: "Conta bloqueada", tone: "error" },
};

export function AffiliateStatusCard({ profile }: { profile: AffiliateMyProfileDto }) {
  const content = STATUS_CONTENT[profile.status];
  if (!content) return null;

  return (
    <Card className="p-6 md:p-8 flex flex-col items-center text-center gap-3 max-w-md mx-auto">
      <span
        className={`flex size-14 items-center justify-center rounded-2xl ${
          content.tone === "purple"
            ? "bg-purple/15 text-purple"
            : content.tone === "warning"
              ? "bg-warning/15 text-warning"
              : "bg-error/15 text-error"
        }`}
      >
        <content.icon className="size-6" />
      </span>
      <p className="font-bold text-lg">{content.title}</p>
      {profile.status === "REJECTED" && profile.rejectionReason && (
        <p className="text-sm text-text-secondary">Motivo: {profile.rejectionReason}</p>
      )}
      {profile.status === "BLOCKED" && profile.blockedReason && (
        <p className="text-sm text-text-secondary">Motivo: {profile.blockedReason}</p>
      )}
      {profile.status === "PENDING" && (
        <p className="text-sm text-text-secondary">
          Enviamos sua solicitação em {new Date(profile.requestedAt).toLocaleDateString("pt-BR")}. Você será
          notificado assim que ela for avaliada.
        </p>
      )}
      {profile.status === "DOCUMENTS_REQUESTED" && (
        <p className="text-sm text-text-secondary">
          Entre em contato com o suporte para enviar os documentos solicitados e dar continuidade à análise.
        </p>
      )}
    </Card>
  );
}
