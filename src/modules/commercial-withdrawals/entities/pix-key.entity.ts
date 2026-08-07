import type { PixKeyType } from "@prisma/client";

export type { PixKeyType };

/** Domain entity — a reusable, saved PIX destination for an Affiliate/Manager's commercial withdrawals (see schema.prisma's PixKey doc comment). */
export interface PixKey {
  id: string;
  userId: string;
  type: PixKeyType;
  keyEncrypted: string;
  holderCpf: string;
  createdAt: Date;
  updatedAt: Date;
}
