import { z } from "zod";
import { usernameSchema, passwordSchema } from "@/modules/identity/validators/auth.validator";

const roleEnum = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "OPERATOR",
  "MODERATOR",
  "SUPPORT",
  "COMPLIANCE",
  "AUDIT",
  "USER",
  "AFFILIATE",
]);

const statusEnum = z.enum(["ACTIVE", "PENDING", "BLOCKED", "SUSPENDED"]);

export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    username: usernameSchema,
    email: z.string().trim().toLowerCase().email(),
    password: passwordSchema,
    phone: z.string().trim().max(20).optional(),
    role: roleEnum.optional(),
    status: statusEnum.optional(),
  })
  .strict();

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    username: usernameSchema.optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    avatar: z.string().trim().max(2048).nullable().optional(),
    cpf: z.string().trim().max(14).nullable().optional(),
    dateOfBirth: z.string().datetime().nullable().optional(),
    locale: z.string().trim().max(10).optional(),
    timezone: z.string().trim().max(60).optional(),
    role: roleEnum.optional(),
    status: statusEnum.optional(),
    tags: z.array(z.string().trim().max(40)).max(20).optional(),
  })
  .strict();

export const userSearchSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: statusEnum.optional(),
  role: roleEnum.optional(),
  emailVerified: z.coerce.boolean().optional(),
  phoneVerified: z.coerce.boolean().optional(),
  mfaEnabled: z.coerce.boolean().optional(),
  locked: z.coerce.boolean().optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(["createdAt", "lastLoginAt", "firstName", "email", "status"])
    .optional()
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export { roleEnum, statusEnum };
