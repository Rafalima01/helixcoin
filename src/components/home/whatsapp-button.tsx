import Image from "next/image";
import { COMMUNITY_URL } from "@/config/community";

/**
 * Discreet floating link to the official community (WhatsApp) — renders
 * nothing until NEXT_PUBLIC_COMMUNITY_URL is actually configured, never a
 * guessed/placeholder link. Icon is the official asset provided for this
 * button — trimmed/resized only, pixels untouched (public/whatsapp-icon.webp).
 */
export function WhatsappButton() {
  if (!COMMUNITY_URL) return null;

  return (
    <a
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Comunidade no WhatsApp"
      className="fixed bottom-24 right-4 z-30 flex size-12 items-center justify-center transition-transform hover:scale-105"
    >
      <Image src="/whatsapp-icon.webp" alt="" fill className="object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]" />
    </a>
  );
}
