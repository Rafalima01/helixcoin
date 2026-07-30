-- Fase 10 — Hardening da arquitetura de pagamentos: nova coluna Mock-only
-- para simular falhas de CHAMADA de gateway (timeout/erro 500/erro de
-- autenticação/offline), independente de "simulatedHealth" (que só afeta o
-- resultado reportado por health()). Aditiva, sem impacto em dados
-- existentes.

-- CreateEnum
CREATE TYPE "GatewaySimulatedFault" AS ENUM ('TIMEOUT', 'ERROR_500', 'AUTH_ERROR', 'OFFLINE_CALLS');

-- AlterTable
ALTER TABLE "GatewayCredential" ADD COLUMN "simulatedErrorMode" "GatewaySimulatedFault";
