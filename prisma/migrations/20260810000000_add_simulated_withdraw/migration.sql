-- Saque simulado para Contas Demo (User.isDemo).
--
-- A separacao entre saque REAL e saque DEMO e estrutural, nao apenas logica:
-- um saque simulado NAO tem gatewayCredentialId, entao nao existe credencial
-- para o ProviderFactory resolver e o codigo de gateway nao tem por onde
-- rodar. A CHECK constraint abaixo torna esse invariante uma regra do banco,
-- de modo que nem uma alteracao futura descuidada no servico consegue criar
-- um saque simulado apontando para um gateway real (ou um saque real sem
-- gateway).

-- 1) gatewayCredentialId passa a ser opcional (era NOT NULL).
ALTER TABLE "Withdraw" ALTER COLUMN "gatewayCredentialId" DROP NOT NULL;

-- 2) Marcador explicito e impossivel de confundir.
ALTER TABLE "Withdraw" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;

-- 3) Invariante de banco: simulado <=> sem gateway.
ALTER TABLE "Withdraw"
  ADD CONSTRAINT "Withdraw_simulated_gateway_check"
  CHECK (
    ("isSimulated" = true  AND "gatewayCredentialId" IS NULL)
    OR
    ("isSimulated" = false AND "gatewayCredentialId" IS NOT NULL)
  );

-- 4) Indice para o filtro "Reais / Simulacoes" do backoffice.
CREATE INDEX "Withdraw_isSimulated_idx" ON "Withdraw"("isSimulated");
