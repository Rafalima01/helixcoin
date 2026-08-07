import type { PixKey, PixKeyType } from "@/modules/commercial-withdrawals/entities/pix-key.entity";

export interface CreatePixKeyInput {
  userId: string;
  type: PixKeyType;
  keyEncrypted: string;
  holderCpf: string;
}

export interface IPixKeyRepository {
  list(userId: string): Promise<PixKey[]>;
  findById(id: string): Promise<PixKey | null>;
  create(input: CreatePixKeyInput): Promise<PixKey>;
  update(id: string, input: Partial<CreatePixKeyInput>): Promise<PixKey>;
  delete(id: string): Promise<void>;
}
