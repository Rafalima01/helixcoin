import { BalanceCard } from "@/components/home/balance-card";
import { BetPanel } from "@/components/home/bet-panel";
import { RecentActivity } from "@/components/home/recent-activity";
import { AccountSummary } from "@/components/home/account-summary";
import { OnlineWidget } from "@/components/home/online-widget";
import { LiveTicker } from "@/components/landing/live-ticker";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <LiveTicker />

      <div className="mx-auto w-full max-w-3xl px-4 md:px-8 py-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Bem-vindo de volta</h1>
            <p className="text-text-secondary mt-1">
              Pronto para girar a torre e multiplicar seu saldo?
            </p>
          </div>
          <OnlineWidget />
        </div>

        <BalanceCard />
        <BetPanel />
        <AccountSummary />
        <RecentActivity />
      </div>
    </div>
  );
}
