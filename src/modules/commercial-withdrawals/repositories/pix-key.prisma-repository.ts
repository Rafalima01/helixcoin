import type { PixKey as PrismaPixKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPixKeyRepository,
  CreatePixKeyInput,
} from "@/modules/commercial-withdrawals/interfaces/pix-key-repository.interface";
import type { PixKey } from "@/modules/commercial-withdrawals/entities/pix-key.entity";

function toEntity(row: PrismaPixKey): PixKey {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    keyEncrypted: row.keyEncrypted,
    holderCpf: row.holderCpf,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPixKeyRepository implements IPixKeyRepository {
  async list(userId: string): Promise<PixKey[]> {
    const rows = await prisma.pixKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<PixKey | null> {
    const row = await prisma.pixKey.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async create(input: CreatePixKeyInput): Promise<PixKey> {
    const row = await prisma.pixKey.create({
      data: {
        userId: input.userId,
        type: input.type,
        keyEncrypted: input.keyEncrypted,
        holderCpf: input.holderCpf,
      },
    });
    return toEntity(row);
  }

  async update(id: string, input: Partial<CreatePixKeyInput>): Promise<PixKey> {
    const row = await prisma.pixKey.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.keyEncrypted !== undefined ? { keyEncrypted: input.keyEncrypted } : {}),
        ...(input.holderCpf !== undefined ? { holderCpf: input.holderCpf } : {}),
      },
    });
    return toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.pixKey.delete({ where: { id } });
  }
}
