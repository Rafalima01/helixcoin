import type { Metadata } from "next";
import { ReferralsScreen } from "@/components/referrals/referrals-screen";

export const metadata: Metadata = { title: "Indique e Ganhe — HeliJump" };

export default function ReferralsPage() {
  return <ReferralsScreen />;
}
