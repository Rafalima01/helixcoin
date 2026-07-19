import type { Metadata } from "next";
import { ProfileScreen } from "@/components/profile/profile-screen";

export const metadata: Metadata = { title: "Perfil — HeliJump" };

export default function ProfilePage() {
  return <ProfileScreen />;
}
