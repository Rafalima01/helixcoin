import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { AtSign, MessageCircle, Video } from "lucide-react";

const COLUMNS = [
  {
    title: "Plataforma",
    links: [
      { label: "Como funciona", href: "#como-funciona" },
      { label: "Multiplicadores", href: "#multiplicadores" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Conta",
    links: [
      { label: "Entrar", href: "/login" },
      { label: "Criar Conta", href: "/signup" },
      { label: "Indicação", href: "/referral" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de uso", href: "#" },
      { label: "Privacidade", href: "#" },
      { label: "Jogo responsável", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border py-14">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-text-secondary max-w-xs leading-relaxed">
              A plataforma de skill game mais premium do Brasil. Habilidade,
              timing e reflexo — nada de sorte.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {[AtSign, MessageCircle, Video].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex size-9 items-center justify-center rounded-full glass-panel border border-border text-text-secondary hover:text-white hover:border-purple/50 transition-colors"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-text mb-4">{col.title}</h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-text-secondary hover:text-white transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>© {new Date().getFullYear()} HeliJump. Todos os direitos reservados.</p>
          <p>Jogue com responsabilidade. Proibido para menores de 18 anos.</p>
        </div>
      </div>
    </footer>
  );
}
