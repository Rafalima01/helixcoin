"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AffiliatePanel } from "@/components/referrals/affiliate/affiliate-panel";

/**
 * "Indique" — the platform's ONE and only affiliate entry point (see
 * AGENTS.md's "Painel do Afiliado Integrado ao Frontend" correction: no
 * separate tab/menu in Perfil, everything lives here). `?manager=CODE`
 * arrives from /affiliate-invite/[code]/route.ts's redirect and prefills the
 * apply form when the visitor isn't an affiliate yet.
 */
function ReferralsScreenInner() {
  const searchParams = useSearchParams();
  const managerCode = searchParams.get("manager") ?? undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 flex flex-col gap-6">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Indique e <span className="text-gradient-brand">Ganhe</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-xl leading-relaxed">
          Convide seus amigos para jogar no HeliJump e ganhe comissões reais conforme eles se tornam
          jogadores ativos e realizam depósitos.
        </p>
      </div>

      <AffiliatePanel prefillManagerCode={managerCode} />
    </div>
  );
}

export function ReferralsScreen() {
  return (
    <Suspense fallback={null}>
      <ReferralsScreenInner />
    </Suspense>
  );
}
