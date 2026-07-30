export function Footer() {
  return (
    <footer className="relative border-t border-border py-8">
      <div className="mx-auto max-w-7xl px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
        <p>© {new Date().getFullYear()} HelixCoin. Todos os direitos reservados.</p>
        <p>Jogue com responsabilidade. Proibido para menores de 18 anos.</p>
      </div>
    </footer>
  );
}
