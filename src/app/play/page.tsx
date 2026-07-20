import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth";
import { PlayScreen } from "@/components/game/play-screen";

export const metadata: Metadata = { title: "Jogando — HeliJump" };

export default async function PlayPage() {
  const auth = await getServerAuthContext();
  if (!auth) redirect("/login");

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-app-radial">
      <PlayScreen />
    </div>
  );
}
