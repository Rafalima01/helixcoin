"use client";

import { useState } from "react";
import {
  Users,
  Coins,
  Wallet,
  TrendingUp,
  Copy,
  Check,
  Share2,
  Send,
  UserPlus,
  Trophy,
  Lightbulb,
  Gift,
  ChevronDown,
  ChevronRight,
  Network,
  CircleUser,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { useReferralStats, type NetworkNode } from "@/hooks/use-profile";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Send,
    title: "Compartilhe seu link",
    text: "Envie para amigos via WhatsApp, Telegram, redes sociais ou e-mail.",
  },
  {
    icon: UserPlus,
    title: "Seus amigos criam uma conta",
    text: "Através do seu link, eles passam automaticamente a fazer parte da sua rede de indicação.",
  },
  {
    icon: Trophy,
    title: "Ganhe recompensas",
    text: "Receba comissões conforme seus convidados se tornam jogadores ativos e realizam depósitos.",
  },
];

const LEVEL_STYLES = [
  { chip: "text-purple bg-purple/15 border-purple/25", bar: "from-purple/25 to-purple/5 border-purple/30" },
  { chip: "text-pink bg-pink/15 border-pink/25", bar: "from-pink/25 to-pink/5 border-pink/30" },
  { chip: "text-green bg-green/15 border-green/25", bar: "from-green/25 to-green/5 border-green/30" },
];

/** The single referral link card — one code, one link, per user. */
function MyLinkCard({ code, linkPath }: { code: string; linkPath: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const link =
    typeof window !== "undefined" ? `${window.location.origin}${linkPath}` : `helijump.gg${linkPath}`;

  const copy = async (value: string, kind: "link" | "code") => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    toast.success(kind === "link" ? "Link copiado!" : "Código copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const share = async () => {
    const payload = {
      title: "HeliJump — Gire e Ganhe",
      text: "Crie sua conta no HeliJump pelo meu link e jogue comigo!",
      url: link,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      await copy(link, "link");
    }
  };

  return (
    <Card glow="purple" className="p-6 md:p-8 bg-gradient-to-br from-purple/15 via-transparent to-pink/10">
      <div className="flex items-center gap-3 mb-5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-white">
          <Gift className="size-5" />
        </span>
        <div>
          <p className="font-bold text-lg leading-tight">Meu Link de Indicação</p>
          <p className="text-xs text-text-secondary">Um único link para toda a sua rede.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-[auto_1fr] gap-3 mb-4">
        <button
          onClick={() => copy(code, "code")}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3 text-left"
          title="Copiar código"
        >
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">Código</p>
            <p className="text-lg font-extrabold tracking-widest text-gradient-brand">{code}</p>
          </div>
          {copied === "code" ? (
            <Check className="size-4 text-green shrink-0" />
          ) : (
            <Copy className="size-4 text-text-muted shrink-0" />
          )}
        </button>

        <button
          onClick={() => copy(link, "link")}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3 text-left min-w-0"
          title="Copiar link"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">Link</p>
            <p className="text-sm font-semibold text-text-secondary truncate">{link}</p>
          </div>
          {copied === "link" ? (
            <Check className="size-4 text-green shrink-0" />
          ) : (
            <Copy className="size-4 text-text-muted shrink-0" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={() => copy(link, "link")}>
          <Copy className="size-4" />
          Copiar
        </Button>
        <Button variant="primary" size="lg" onClick={share}>
          <Share2 className="size-4" />
          Compartilhar
        </Button>
      </div>
    </Card>
  );
}

/** One expandable node of the referral tree. */
function TreeNode({ node }: { node: NetworkNode }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  const style = LEVEL_STYLES[node.level - 1];

  return (
    <div className="flex flex-col">
      <button
        onClick={() => hasChildren && setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] px-3 py-2.5 text-left transition-colors",
          hasChildren && "hover:border-border-strong cursor-pointer"
        )}
      >
        <span className="shrink-0 text-text-muted">
          {hasChildren ? (
            open ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )
          ) : (
            <span className="block size-4" />
          )}
        </span>

        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple/60 to-pink/60 text-xs font-bold text-white">
          {node.name.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold truncate">{node.name}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", style.chip)}>
              Nível {node.level}
            </span>
            <Badge variant={node.active ? "green" : "neutral"} size="sm">
              {node.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-[11px] text-text-muted tabular-nums">
            Cadastro {new Date(node.createdAt).toLocaleDateString("pt-BR")} ·{" "}
            {node.deposited ? `${node.depositCount} depósito${node.depositCount > 1 ? "s" : ""}` : "Sem depósitos"}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 text-sm font-bold tabular-nums",
            node.commissionCents > 0 ? "text-green" : "text-text-muted"
          )}
        >
          {formatCurrency(centsToReais(node.commissionCents))}
        </span>
      </button>

      {hasChildren && open && (
        <div className="ml-5 mt-1.5 flex flex-col gap-1.5 border-l border-border pl-3">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReferralsScreen() {
  const { data, isLoading } = useReferralStats();

  const summary = [
    { label: "Amigos convidados", icon: Users, value: data?.totals.invited ?? 0, money: false },
    { label: "Rede total", icon: Network, value: data?.totals.networkSize ?? 0, money: false },
    { label: "Depositantes", icon: Wallet, value: data?.totals.depositors ?? 0, money: false },
    {
      label: "Comissão acumulada",
      icon: TrendingUp,
      value: centsToReais(data?.totals.commissionCents ?? 0),
      money: true,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 flex flex-col gap-8">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Indique e <span className="text-gradient-brand">Ganhe</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-xl leading-relaxed">
          Convide seus amigos para jogar no HeliJump. Quanto mais amigos você indicar, maiores
          serão suas recompensas.
        </p>
      </div>

      {/* Single referral link */}
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <MyLinkCard code={data.referralCode} linkPath={data.linkPath} />
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((s) => (
          <Card key={s.label} className="p-4 flex flex-col gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-purple/15 text-purple">
              <s.icon className="size-4" />
            </span>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-xl md:text-2xl font-extrabold tabular-nums">
                {s.money ? (
                  <AnimatedNumber value={s.value} format={(v) => formatCurrency(v)} />
                ) : (
                  <AnimatedNumber value={s.value} format={(v) => String(Math.round(v))} />
                )}
              </p>
            )}
            <p className="text-xs text-text-secondary leading-tight">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Minha Rede — per-level stats (levels = tree depth, computed by the API) */}
      <div>
        <h2 className="font-bold text-lg mb-3">Minha Rede</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {isLoading || !data
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)
            : data.levels.map((l) => {
                const style = LEVEL_STYLES[l.level - 1];
                return (
                  <Card key={l.level} className={cn("p-5 bg-gradient-to-br border", style.bar)}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <p className="font-bold">Nível {l.level}</p>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", style.chip)}>
                        Comissão {l.ratePct}%
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary flex items-center gap-1.5">
                          <Users className="size-3.5" /> Indicados
                        </span>
                        <span className="font-bold tabular-nums">{l.invited}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary flex items-center gap-1.5">
                          <Coins className="size-3.5" /> Depositantes
                        </span>
                        <span className="font-bold tabular-nums">{l.depositors}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary flex items-center gap-1.5">
                          <TrendingUp className="size-3.5" /> Comissão
                        </span>
                        <span className="font-bold tabular-nums text-green">
                          {formatCurrency(centsToReais(l.commissionCents))}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>
      </div>

      {/* Network tree */}
      <div>
        <h2 className="font-bold text-lg mb-3">Árvore da rede</h2>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : (
          <Card className="p-4 md:p-5">
            <div className="flex items-center gap-3 rounded-xl border border-purple/30 bg-purple/10 px-3 py-2.5 mb-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple to-pink text-white">
                <CircleUser className="size-4" />
              </span>
              <p className="text-sm font-bold">Você</p>
              <span className="ml-auto text-[11px] text-text-muted">
                {data.totals.networkSize} pessoa{data.totals.networkSize === 1 ? "" : "s"} na rede
              </span>
            </div>

            {data.tree.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Network className="size-7 text-text-muted" />
                <p className="text-sm text-text-secondary">Sua rede ainda está vazia</p>
                <p className="text-xs text-text-muted">
                  Compartilhe seu link para começar a construir sua árvore de indicações.
                </p>
              </div>
            ) : (
              <div className="ml-4 flex flex-col gap-1.5 border-l border-border pl-3">
                {data.tree.map((node) => (
                  <TreeNode key={node.id} node={node} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* How it works */}
      <div>
        <h2 className="font-bold text-lg mb-3">Como funciona</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-pink text-white text-sm font-extrabold">
                  {i + 1}
                </span>
                <step.icon className="size-4 text-text-secondary" />
              </div>
              <p className="font-semibold text-[15px]">{step.title}</p>
              <p className="text-sm text-text-secondary leading-relaxed">{step.text}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Tip */}
      <Card glow="purple" className="p-5 md:p-6 bg-gradient-to-br from-purple/15 via-transparent to-pink/10">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <Lightbulb className="size-5" />
          </span>
          <div>
            <p className="font-bold mb-1">Dica</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Quanto mais amigos você convidar, maiores serão suas recompensas e seu potencial de
              ganhos.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
