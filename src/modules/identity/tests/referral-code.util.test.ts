import { describe, expect, it } from "vitest";
import {
  generateReferralCode,
  generateNeutralReferralCode,
} from "@/modules/identity/utils/referral-code.util";

describe("generateReferralCode — comportamento existente preservado", () => {
  it("continua derivando o prefixo do nome para jogadores comuns", () => {
    expect(generateReferralCode("Rafael")).toMatch(/^RAFAE[A-Z0-9]{4}$/);
    expect(generateReferralCode("Ana")).toMatch(/^ANA[A-Z0-9]{4}$/);
  });

  it("normaliza acentos e ignora caracteres nao alfabeticos", () => {
    expect(generateReferralCode("João")).toMatch(/^JOAO[A-Z0-9]{4}$/);
    expect(generateReferralCode("Ma-ri.a 2")).toMatch(/^MARIA[A-Z0-9]{4}$/);
  });

  it("cai para PLAYER quando o nome nao tem letras", () => {
    expect(generateReferralCode("123")).toMatch(/^PLAYER[A-Z0-9]{4}$/);
  });
});

describe("generateNeutralReferralCode — codigo sem pista do titular", () => {
  it("nunca comeca com DEMO, em qualquer capitalizacao", () => {
    // Volume alto de propósito: a garantia precisa valer sempre, não na média.
    for (let i = 0; i < 20_000; i++) {
      expect(generateNeutralReferralCode()).not.toMatch(/^demo/i);
    }
  });

  it("nao contem a palavra demo em lugar nenhum do codigo", () => {
    for (let i = 0; i < 20_000; i++) {
      expect(generateNeutralReferralCode()).not.toMatch(/demo/i);
    }
  });

  it("tem o mesmo comprimento de um codigo normal — indistinguivel visualmente", () => {
    const normal = generateReferralCode("Rafael"); // 5 + 4
    for (let i = 0; i < 500; i++) {
      expect(generateNeutralReferralCode()).toHaveLength(normal.length);
    }
  });

  it("usa apenas maiusculas e digitos, sem caracteres ambiguos (0 O 1 I)", () => {
    for (let i = 0; i < 5_000; i++) {
      expect(generateNeutralReferralCode()).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  it("produz codigos praticamente sempre distintos", () => {
    const gerados = new Set<string>();
    for (let i = 0; i < 5_000; i++) gerados.add(generateNeutralReferralCode());
    // 32^9 combinacoes: colisao em 5k amostras e desprezivel.
    expect(gerados.size).toBe(5_000);
  });
});
