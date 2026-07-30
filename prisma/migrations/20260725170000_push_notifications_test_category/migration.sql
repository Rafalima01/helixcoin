-- Fase X ajuste final — "Enviar Notificação de Teste" button. Adds a single
-- enum value; no table changes. TEST is intentionally excluded from
-- NOTIFICATION_CATEGORIES (src/modules/notifications/constants) so it never
-- shows up in the preferences UI or gets opted out of.
ALTER TYPE "NotificationCategory" ADD VALUE 'TEST';
