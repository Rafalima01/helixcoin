-- Preserves the unique identity fields (email/username/phone/cpf) of a
-- soft-deleted User so restore() can bring them back — softDelete() itself
-- now overwrites those columns with tombstone values, since they carry
-- plain (non-partial) UNIQUE constraints that don't know about deletedAt.
ALTER TABLE "User" ADD COLUMN "deletedIdentitySnapshot" JSONB;
