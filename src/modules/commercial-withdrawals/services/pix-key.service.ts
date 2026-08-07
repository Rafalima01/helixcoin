import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { encrypt } from "@/server/security/crypto-utils";
import type { IPixKeyRepository } from "@/modules/commercial-withdrawals/interfaces/pix-key-repository.interface";
import type { ICommercialWithdrawRepository } from "@/modules/commercial-withdrawals/interfaces/commercial-withdraw-repository.interface";
import type { IUserRepository } from "@/modules/identity/interfaces/user-repository.interface";
import type { PixKey, PixKeyType } from "@/modules/commercial-withdrawals/entities/pix-key.entity";

export interface UpsertPixKeyInput {
  type: PixKeyType;
  key: string;
  holderCpf: string;
}

/**
 * Owns the reusable, saved PIX-key catalog behind commercial withdrawals.
 * Role-agnostic by design — the same service backs both the Affiliate and
 * Manager "/pix-keys" endpoints (see commercial-withdraw.controller.ts),
 * scoped purely by `userId`.
 */
export class PixKeyService {
  constructor(
    private readonly pixKeys: IPixKeyRepository,
    private readonly commercialWithdraws: ICommercialWithdrawRepository,
    private readonly users: IUserRepository
  ) {}

  async list(userId: string): Promise<PixKey[]> {
    return this.pixKeys.list(userId);
  }

  /** "Caso utilize CPF como chave, ele deve ser igual ao CPF cadastrado na conta" — the one hard validation rule this module enforces beyond shape. */
  private async assertCpfKeyMatchesAccount(userId: string, type: PixKeyType, key: string): Promise<void> {
    if (type !== "CPF") return;
    const user = await this.users.findById(userId);
    if (!user?.cpf || key.replace(/\D/g, "") !== user.cpf.replace(/\D/g, "")) {
      throw new ValidationError("A chave PIX do tipo CPF deve ser igual ao CPF cadastrado na conta");
    }
  }

  async create(userId: string, input: UpsertPixKeyInput): Promise<PixKey> {
    await this.assertCpfKeyMatchesAccount(userId, input.type, input.key);
    return this.pixKeys.create({
      userId,
      type: input.type,
      keyEncrypted: encrypt(input.key),
      holderCpf: input.holderCpf,
    });
  }

  async update(userId: string, id: string, input: Partial<UpsertPixKeyInput>): Promise<PixKey> {
    const existing = await this.pixKeys.findById(id);
    if (!existing) throw new NotFoundError("Chave PIX");
    if (existing.userId !== userId) throw new ForbiddenError();

    const type = input.type ?? existing.type;
    if (input.key !== undefined) {
      await this.assertCpfKeyMatchesAccount(userId, type, input.key);
    } else if (input.type !== undefined && input.type === "CPF" && existing.type !== "CPF") {
      // Type changed to CPF without a new key — validate the existing (still encrypted) key can't be checked without decrypting; require the caller to resend `key` in that case.
      throw new ValidationError("Informe a chave PIX novamente ao alterar o tipo para CPF");
    }

    return this.pixKeys.update(id, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.key !== undefined ? { keyEncrypted: encrypt(input.key) } : {}),
      ...(input.holderCpf !== undefined ? { holderCpf: input.holderCpf } : {}),
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.pixKeys.findById(id);
    if (!existing) throw new NotFoundError("Chave PIX");
    if (existing.userId !== userId) throw new ForbiddenError();

    const hasPending = await this.commercialWithdraws.hasPendingForPixKey(id);
    if (hasPending) {
      throw new BusinessRuleError("Não é possível remover uma chave PIX com saque pendente de aprovação");
    }

    await this.pixKeys.delete(id);
  }
}
