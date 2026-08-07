"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IdentityAdminApi, ApiError } from "@/lib/admin/identity-api";

const STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "OPERATOR",
  "MODERATOR",
  "SUPPORT",
  "COMPLIANCE",
  "AUDIT",
] as const;

const ROLE_LABEL: Record<(typeof STAFF_ROLES)[number], string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  FINANCE: "Financeiro",
  OPERATOR: "Operador",
  MODERATOR: "Moderador",
  SUPPORT: "Suporte",
  COMPLIANCE: "Compliance",
  AUDIT: "Auditoria",
};

const UPPER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no O/I — avoids visual ambiguity
const LOWER_CHARS = "abcdefghjkmnpqrstuvwxyz";
const DIGIT_CHARS = "23456789";
const SYMBOL_CHARS = "!@#$%&*";

/** Cryptographically secure — admin accounts carry more privilege than a Conta Demo, so this doesn't reuse Math.random()-based generateDemoPassword. */
function generateSecurePassword(): string {
  const all = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS + SYMBOL_CHARS;
  const pools = [UPPER_CHARS, LOWER_CHARS, DIGIT_CHARS, SYMBOL_CHARS];
  const randomIndex = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };
  const chars = [
    ...pools.map((pool) => pool[randomIndex(pool.length)]),
    ...Array.from({ length: 10 }, () => all[randomIndex(all.length)]),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

interface CreatedAdmin {
  email: string;
  username: string;
  password: string;
}

export function CreateAdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<(typeof STAFF_ROLES)[number]>("SUPPORT");
  const [result, setResult] = useState<CreatedAdmin | null>(null);
  const [copiedField, setCopiedField] = useState<"password" | "all" | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const password = generateSecurePassword();
      return IdentityAdminApi.createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        role,
        status: "ACTIVE",
      }).then((res) => ({ email: res.data.email, username: res.data.username, password }));
    },
    onSuccess: (created) => {
      setResult(created);
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao criar administrador"),
  });

  const handleClose = () => {
    setFirstName("");
    setLastName("");
    setUsername("");
    setEmail("");
    setPhone("");
    setRole("SUPPORT");
    setResult(null);
    setCopiedField(null);
    onClose();
  };

  const copy = async (field: "password" | "all", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    username.trim().length >= 3 &&
    email.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={result ? "Administrador criado" : "Convidar administrador"}
      description={
        result
          ? "Guarde a senha agora — ela não será exibida novamente. Repasse ao novo administrador por um canal seguro."
          : "Cria uma conta com acesso imediato ao backoffice, no papel escolhido abaixo."
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-black/30 p-4 flex flex-col gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-text-muted">Login</p>
              <p className="font-mono text-sm font-semibold truncate">{result.email}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">Senha</p>
                <p className="font-mono text-sm font-semibold truncate">{result.password}</p>
              </div>
              <button
                onClick={() => copy("password", result.password)}
                className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Copiar senha"
              >
                {copiedField === "password" ? <Check className="size-4 text-green" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => copy("all", `Login: ${result.email} / Senha: ${result.password}`)}
          >
            {copiedField === "all" ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar Login e Senha
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Maria" />
            <Input label="Sobrenome" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Silva" />
          </div>
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@empresa.com"
          />
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="maria_silva"
            hint="Apenas letras minúsculas, números e underscore."
          />
          <Input
            label="Telefone (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 11 99999-0000"
          />
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-text-secondary">Papel (RBAC)</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof STAFF_ROLES)[number])}
              className="w-full h-12 rounded-2xl bg-white/[0.03] border border-border px-4 text-[15px] text-text outline-none transition-all duration-200 focus:border-purple/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <Button variant="primary" loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
            Criar administrador
          </Button>
        </div>
      )}
    </Modal>
  );
}
