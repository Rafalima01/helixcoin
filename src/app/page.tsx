import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { LiveTicker } from "@/components/landing/live-ticker";
import { RecentWins } from "@/components/landing/recent-wins";
import { Benefits } from "@/components/landing/benefits";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MultiplierTable } from "@/components/landing/multiplier-table";
import { DemoVideo } from "@/components/landing/demo-video";
import { Stats } from "@/components/landing/stats";
import { FaqSection } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <LiveTicker />
        <RecentWins />
        <Benefits />
        <HowItWorks />
        <MultiplierTable />
        <DemoVideo />
        <Stats />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
