"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Wallet, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePixKeys,
  useCreatePixKey,
  useUpdatePixKey,
  useDeletePixKey,
  useRequestCommercialWithdraw,
  type CommercialWithdrawRole,
  type PixKeyDto,
} from "@/hooks/use-commercial-withdrawals";
import { formatCurrency } from "@/lib/utils";

type Step = "select" | "new" | "amount";

const PIX_KEY_TYPES: { value: string; label: string }[] = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave Aleatória" },
];

function typeLabel(type: string): string {
  return PIX_KEY_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function PixKeyWithdrawModal({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: CommercialWithdrawRole;
}) {
  const { data: pixKeys, isLoading: pixKeysLoading } = usePixKeys(role);
  const createPixKey = useCreatePixKey(role);
  const updatePixKey = useUpdatePixKey(role);
  const deletePixKey = useDeletePixKey(role);
  const requestWithdraw = useRequestCommercialWithdraw(role);

  // `step` is only ever set explicitly by a user action (never by an effect
  // reacting to `pixKeys` loading) — while it's still `null` (nothing chosen
  // yet this time the modal is open), the render below derives which step to
  // show directly from the query result: "new" for a first-time user with
  // zero saved keys, "select" otherwise.
  const [step, setStep] = useState<Step | null>(null);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [selectedPixKeyId, setSelectedPixKeyId] = useState<string | null>(null);
  const [newType, setNewType] = useState("EMAIL");
  const [newKey, setNewKey] = useState("");
  const [newHolderCpf, setNewHolderCpf] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  const hasKeys = (pixKeys?.length ?? 0) > 0;
  const effectiveStep: Step = step ?? (pixKeysLoading || hasKeys ? "select" : "new");

  const reset = () => {
    setStep(null);
    setEditingKeyId(null);
    setSelectedPixKeyId(null);
    setNewType("EMAIL");
    setNewKey("");
    setNewHolderCpf("");
    setAmount("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectExisting = (key: PixKeyDto) => {
    setSelectedPixKeyId(key.id);
    setStep("amount");
  };

  const handleStartNew = () => {
    setEditingKeyId(null);
    setNewType("EMAIL");
    setNewKey("");
    setNewHolderCpf("");
    setStep("new");
  };

  const handleStartEdit = (key: PixKeyDto) => {
    setEditingKeyId(key.id);
    setNewType(key.type);
    setNewKey("");
    setNewHolderCpf(key.holderCpf);
    setStep("new");
  };

  const handleSaveNewKey = async () => {
    if (newKey.trim().length < 3) {
      toast.error("Informe uma chave PIX válida");
      return;
    }
    if (newHolderCpf.replace(/\D/g, "").length !== 11) {
      toast.error("Informe um CPF do titular válido (11 dígitos)");
      return;
    }
    try {
      const saved = editingKeyId
        ? await updatePixKey.mutateAsync({
            id: editingKeyId,
            type: newType,
            key: newKey.trim(),
            holderCpf: newHolderCpf.replace(/\D/g, ""),
          })
        : await createPixKey.mutateAsync({
            type: newType,
            key: newKey.trim(),
            holderCpf: newHolderCpf.replace(/\D/g, ""),
          });
      setEditingKeyId(null);
      setSelectedPixKeyId(saved.id);
      setStep("amount");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar chave PIX");
    }
  };

  const handleRequestWithdraw = async () => {
    if (!selectedPixKeyId) return;
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    try {
      await requestWithdraw.mutateAsync({ amount: Number(amount), pixKeyId: selectedPixKeyId });
      toast.success("Saque solicitado — aguardando aprovação");
      handleClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao solicitar saque");
    }
  };

  const savingKey = createPixKey.isPending || updatePixKey.isPending;

  return (
    <Modal open={open} onClose={handleClose} title="Solicitar Saque" description="Saques comerciais são sempre revisados por um administrador antes da liberação.">
      <AnimatePresence initial={false} mode="wait">
        {effectiveStep === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            {pixKeysLoading ? (
              <>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </>
            ) : (
              (pixKeys ?? []).map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.03] px-4 py-3"
                >
                  <button onClick={() => handleSelectExisting(key)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold truncate">{key.keyMasked}</p>
                    <p className="text-xs text-text-muted">{typeLabel(key.type)}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(key)}
                      className="flex size-8 items-center justify-center rounded-lg text-text-muted hover:text-purple transition-colors"
                      aria-label="Editar chave PIX"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Remover esta chave PIX?")) return;
                        try {
                          await deletePixKey.mutateAsync(key.id);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erro ao remover chave PIX");
                        }
                      }}
                      className="flex size-8 items-center justify-center rounded-lg text-text-muted hover:text-error transition-colors"
                      aria-label="Remover chave PIX"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}

            <Button variant="outline" onClick={handleStartNew}>
              <Plus className="size-4" /> Cadastrar nova conta
            </Button>
          </motion.div>
        )}

        {effectiveStep === "new" && (
          <motion.div
            key="new"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Tipo de chave</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-white/[0.03] px-4 text-[15px] text-text outline-none transition-all focus:border-purple/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
              >
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Chave PIX"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder={editingKeyId ? "Digite a nova chave PIX" : "Digite a chave PIX"}
            />
            <Input
              label="CPF do titular"
              value={newHolderCpf}
              onChange={(e) => setNewHolderCpf(e.target.value)}
              placeholder="Somente números"
              inputMode="numeric"
            />

            <p className="text-[11px] text-text-muted leading-relaxed">
              A chave PIX deve pertencer ao mesmo titular do cadastro. Você pode utilizar CPF, e-mail, telefone ou
              chave aleatória. Caso utilize CPF como chave, ele deve ser igual ao CPF cadastrado na conta.
            </p>

            <div className="flex gap-2">
              {hasKeys && (
                <Button variant="ghost" onClick={() => setStep("select")} className="border border-border">
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              <Button variant="gold" loading={savingKey} onClick={handleSaveNewKey} className="flex-1">
                Salvar conta
              </Button>
            </div>
          </motion.div>
        )}

        {effectiveStep === "amount" && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.03] px-4 py-3">
              <Wallet className="size-4 text-purple shrink-0" />
              <p className="text-xs text-text-secondary truncate">
                {(pixKeys ?? []).find((k) => k.id === selectedPixKeyId)?.keyMasked ?? "Nova chave cadastrada"}
              </p>
            </div>

            <Input
              label="Valor do saque"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              hint={amount ? `Você está solicitando ${formatCurrency(Number(amount))}` : undefined}
            />

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(hasKeys ? "select" : "new")} className="border border-border">
                <ArrowLeft className="size-4" />
              </Button>
              <Button variant="gold" loading={requestWithdraw.isPending} onClick={handleRequestWithdraw} className="flex-1">
                Solicitar Saque
              </Button>
            </div>

            <p className="text-[11px] text-text-muted text-center">
              Saques comerciais são sempre analisados por um administrador antes de serem liberados.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
