export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

/** Mocked in this phase (ConsoleMailSender logs instead of sending) — swap for a real provider later without touching any call site. */
export interface IMailSender {
  send(message: MailMessage): Promise<void>;
}
