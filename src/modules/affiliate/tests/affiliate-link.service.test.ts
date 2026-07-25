import { describe, expect, it } from "vitest";
import { AffiliateLinkService } from "@/modules/affiliate/services/affiliate-link.service";
import { InMemoryAffiliateLinkRepository } from "@/modules/affiliate/repositories/affiliate-link.in-memory-repository";

const AFFILIATE_ID = "aff-1";

function buildService() {
  const links = new InMemoryAffiliateLinkRepository();
  return { service: new AffiliateLinkService(links), links };
}

describe("AffiliateLinkService", () => {
  it("create() slugifies the name and produces a unique slug on collision", async () => {
    const { service } = buildService();
    const first = await service.create(AFFILIATE_ID, "Campanha Instagram");
    expect(first.slug).toBe("campanha-instagram");

    const second = await service.create(AFFILIATE_ID, "Campanha Instagram");
    expect(second.slug).not.toBe(first.slug);
    expect(second.slug.startsWith("campanha-instagram")).toBe(true);
  });

  it("registerClick() increments the click counter", async () => {
    const { service, links } = buildService();
    const link = await service.create(AFFILIATE_ID, "TikTok");
    await service.registerClick(link.id);
    await service.registerClick(link.id);
    const found = await links.findById(link.id);
    expect(found?.clicks).toBe(2);
  });

  it("findActiveBySlug() returns null for a PAUSED link", async () => {
    const { service } = buildService();
    const link = await service.create(AFFILIATE_ID, "YouTube");
    await service.setStatus(link.id, AFFILIATE_ID, "PAUSED");
    const found = await service.findActiveBySlug(link.slug);
    expect(found).toBeNull();
  });

  it("findActiveBySlug() returns the link when ACTIVE", async () => {
    const { service } = buildService();
    const link = await service.create(AFFILIATE_ID, "Google Ads");
    const found = await service.findActiveBySlug(link.slug);
    expect(found?.id).toBe(link.id);
  });

  it("setStatus()/delete() reject a caller who doesn't own the link", async () => {
    const { service } = buildService();
    const link = await service.create(AFFILIATE_ID, "Owned by aff-1");
    await expect(service.setStatus(link.id, "someone-else", "PAUSED")).rejects.toThrow();
    await expect(service.delete(link.id, "someone-else")).rejects.toThrow();
  });
});
