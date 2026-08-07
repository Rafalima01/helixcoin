import type {
  IPixKeyRepository,
  CreatePixKeyInput,
} from "@/modules/commercial-withdrawals/interfaces/pix-key-repository.interface";
import type { PixKey } from "@/modules/commercial-withdrawals/entities/pix-key.entity";

export class InMemoryPixKeyRepository implements IPixKeyRepository {
  private readonly rows = new Map<string, PixKey>();

  async list(userId: string): Promise<PixKey[]> {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: string): Promise<PixKey | null> {
    return this.rows.get(id) ?? null;
  }

  async create(input: CreatePixKeyInput): Promise<PixKey> {
    const now = new Date();
    const row: PixKey = {
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      keyEncrypted: input.keyEncrypted,
      holderCpf: input.holderCpf,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<CreatePixKeyInput>): Promise<PixKey> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`PixKey ${id} not found`);
    const updated: PixKey = { ...existing, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}
