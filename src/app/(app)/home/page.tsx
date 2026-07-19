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

      <div className="mx-auto w-full max-w-7xl px-4 md:px-8 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="text-text-secondary mt-1">
            Pronto para girar a torre e multiplicar seu saldo?
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <BalanceCard />
            <AccountSummary />
            <OnlineWidget />
            <RecentActivity />
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <BetPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
