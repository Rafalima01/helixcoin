"use client";

import { useState } from "react";
import { Link2, UserPlus, Copy, Check, Share2, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useManagerLinks } from "@/hooks/use-manager";
import type { ManagerLinksDto } from "@/modules/manager/dto/manager.dto";

function LinkBlock({
  icon: Icon,
  title,
  description,
  link,
  stats,
}: {
  icon: typeof Link2;
  title: string;
  description: string;
  link: { url: string; clicks: number };
  stats: { label: string; value: string }[];
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: link.url });
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      await copy();
    }
  };

  return (
    <Card glow="purple" className="w-full p-6 md:p-8 bg-gradient-to-br from-purple/15 via-transparent to-pink/10">
      <div className="flex items-center gap-3 mb-5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-white">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-bold text-lg leading-tight">{title}</p>
          <p className="text-xs text-text-secondary">{description}</p>
        </div>
      </div>

      <button onClick={copy} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3 text-left mb-4">
        <p className="text-sm text-text-secondary truncate">{link.url}</p>
        {copied ? <Check className="size-4 text-green shrink-0" /> : <Copy className="size-4 text-text-muted shrink-0" />}
      </button>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Button variant="secondary" size="sm" onClick={copy}>
          <Copy className="size-4" /> Copiar
        </Button>
        <Button variant="primary" size="sm" onClick={share}>
          <Share2 className="size-4" /> Compartilhar
        </Button>
        <Button variant="ghost" size="sm" className="border border-border opacity-60" disabled title="Em breve">
          <QrCode className="size-4" /> QR Code
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border pt-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">{s.label}</p>
            <p className="text-lg font-extrabold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ManagerLinksScreen() {
  const { data, isLoading } = useManagerLinks();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Links e <span className="text-gradient-brand">Convites</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-xl">
          Dois links, dois propósitos: um capta jogadores diretamente para você, o outro recruta afiliados para
          sua rede.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <LinkBlock
            icon={Link2}
            title="Meu Link da Plataforma"
            description="Envia jogadores direto para você — comissão paga integralmente ao seu teto."
            link={{ url: data.platformLink.url, clicks: data.platformLink.clicks }}
            stats={statsFor(data, "platform")}
          />
          <LinkBlock
            icon={UserPlus}
            title="Convidar Afiliados"
            description="Recruta afiliados para sua rede — não usado para captar jogadores."
            link={{ url: data.inviteLink.url, clicks: data.inviteLink.clicks }}
            stats={statsFor(data, "invite")}
          />
        </div>
      )}
    </div>
  );
}

function statsFor(data: ManagerLinksDto, kind: "platform" | "invite") {
  if (kind === "platform") {
    return [
      { label: "Cliques", value: String(data.platformLink.clicks) },
      { label: "Cadastros", value: String(data.platformLink.signups) },
      { label: "FTD", value: String(data.platformLink.ftd ?? 0) },
      { label: "Conversão", value: `${data.platformLink.conversionPercent}%` },
    ];
  }
  return [
    { label: "Cliques", value: String(data.inviteLink.clicks) },
    { label: "Cadastros", value: String(data.inviteLink.signups) },
    { label: "Conversão", value: `${data.inviteLink.conversionPercent}%` },
  ];
}
