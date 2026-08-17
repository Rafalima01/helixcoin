/**
 * Renders a notification's already-generated body text consistently across
 * every surface that shows one (manager/affiliate "Notificações" list, admin
 * push-notification history table + drawer). Pure presentation: never
 * touches what the text says, only how the same text is laid out —
 * preserves `\n` line breaks from the push templates, wraps instead of
 * clipping long messages, and bolds BRL amounts (`R$ 1.234,56`) so the
 * number that matters doesn't get lost in the sentence around it.
 */
const MONEY_PATTERN = /R\$\s?[\d.,]+/g;

export function NotificationMessage({ text, className }: { text: string; className?: string }) {
  const parts = text.split(MONEY_PATTERN);
  const amounts = text.match(MONEY_PATTERN) ?? [];

  return (
    <span className={className}>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < amounts.length && <strong className="font-semibold">{amounts[i]}</strong>}
        </span>
      ))}
    </span>
  );
}
