-- Cadastro de Gerente: o Admin gera apenas um link de convite (sem identidade
-- do candidato); quem preenche nome/e-mail/telefone é o próprio candidato ao
-- aceitar o convite (ManagerInviteService.accept). Relaxa as duas colunas que
-- antes eram preenchidas pelo Admin na criação.

-- AlterTable
ALTER TABLE "ManagerInvite"
  ALTER COLUMN "name" DROP NOT NULL,
  ALTER COLUMN "email" DROP NOT NULL;
