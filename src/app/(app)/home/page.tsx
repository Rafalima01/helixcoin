import { BetPanel } from "@/components/home/bet-panel";
import { OnlineWidget } from "@/components/home/online-widget";
import { WhatsappButton } from "@/components/home/whatsapp-button";
import { PromoCarousel } from "@/components/home/promo-carousel";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <WhatsappButton />

      {/* Topo: carrossel único dos 3 banners oficiais — mesma região onde
          antes ficava o ticker de "ganhadores" (removido, não duplicado). */}
      <PromoCarousel />

      {/* Centro: saudação compacta + jogadores online (discreto) + Nova Partida em destaque.
          Saldo já vive só no ícone de moeda do Topbar — nada de saldo duplicado aqui. */}
      <div className="mx-auto w-full max-w-3xl px-4 md:px-8 pt-4 pb-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight">Bem-vindo de volta</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Pronto para girar a torre e multiplicar seu saldo?
            </p>
          </div>
          <OnlineWidget />
        </div>

        <BetPanel />
      </div>
    </div>
  );
}
