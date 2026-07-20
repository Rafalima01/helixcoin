import { createChildLogger } from "@/server/logger";
import type { IMailSender, MailMessage } from "@/modules/identity/interfaces/mail-sender.interface";

const logger = createChildLogger({ module: "identity.mail" });

/**
 * Mock mail driver — "Enviar Email (mock nesta fase)" per the Phase 3
 * brief. Logs the message instead of sending it. Swap for a real provider
 * (Resend, SES, Postmark) by writing another IMailSender implementation;
 * no service call site changes.
 */
export class ConsoleMailSender implements IMailSender {
  async send(message: MailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject, body: message.body }, "mock email sent");
  }
}
