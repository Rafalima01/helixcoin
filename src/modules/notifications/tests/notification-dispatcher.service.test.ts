import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { eventBus } from "@/server/events";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import { AFFILIATE_EVENTS } from "@/modules/affiliate/events/affiliate.events";
import { MANAGER_EVENTS } from "@/modules/manager/events/manager.events";
import { DAILY_SUMMARY_EVENTS } from "@/modules/notifications/events/notifications.events";
import { buildDispatcherTestHarness, seedActiveSubscription } from "@/modules/notifications/tests/test-helpers";

describe("NotificationDispatcherService", () => {
  let unsubscribe: (() => void) | undefined;

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = undefined;
  });

  it("depositConfirmed broadcasts DEPOSIT_CONFIRMED to every admin and enqueues one job per active subscription", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1", "admin-2"]);
    await seedActiveSubscription(subscriptions, "admin-1", "device-a");
    await seedActiveSubscription(subscriptions, "admin-1", "device-b"); // second device, same admin
    await seedActiveSubscription(subscriptions, "admin-2", "device-c");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(PAYMENT_EVENTS.depositConfirmed, {
      depositId: "dep-1",
      userId: "player-1",
      amountCents: 5000,
      gatewayCredentialId: "cred-1",
      status: "PAID",
    });

    await vi.waitFor(() => expect(enqueuedJobs.length).toBeGreaterThanOrEqual(3));
    const depositJobs = enqueuedJobs.filter((j) => j.payload.category === "DEPOSIT_CONFIRMED");
    expect(depositJobs).toHaveLength(3); // 2 devices for admin-1 + 1 for admin-2
    expect(depositJobs.every((j) => j.payload.title === "💰 Novo depósito")).toBe(true);
  });

  it("depositConfirmed also notifies the depositor's manager when one exists in the referral chain, and nobody when it doesn't", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    recipients.setManagerForUser("player-with-manager", "manager-user-1");
    await seedActiveSubscription(subscriptions, "admin-1");
    await seedActiveSubscription(subscriptions, "manager-user-1");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(PAYMENT_EVENTS.depositConfirmed, {
      depositId: "dep-2",
      userId: "player-with-manager",
      amountCents: 1000,
      gatewayCredentialId: "cred-1",
      status: "PAID",
    });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "MANAGER_NETWORK_DEPOSIT_CONFIRMED")).toBe(true));
    const managerJob = enqueuedJobs.find((j) => j.payload.category === "MANAGER_NETWORK_DEPOSIT_CONFIRMED");
    expect(managerJob?.subscriptionId).toBeTruthy();
  });

  it("depositConfirmed from a player with NO manager in the chain never enqueues a MANAGER_NETWORK_DEPOSIT_CONFIRMED job", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    await seedActiveSubscription(subscriptions, "admin-1");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(PAYMENT_EVENTS.depositConfirmed, {
      depositId: "dep-3",
      userId: "player-no-manager",
      amountCents: 1000,
      gatewayCredentialId: "cred-1",
      status: "PAID",
    });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "DEPOSIT_CONFIRMED")).toBe(true));
    expect(enqueuedJobs.some((j) => j.payload.category === "MANAGER_NETWORK_DEPOSIT_CONFIRMED")).toBe(false);
  });

  it("withdrawRequested/Approved/Rejected all broadcast to admins only", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    await seedActiveSubscription(subscriptions, "admin-1");

    unsubscribe = dispatcher.subscribeToEvents();
    const basePayload = { withdrawId: "wd-1", userId: "player-1", amountCents: 2000, gatewayCredentialId: "cred-1" };
    eventBus.publish(PAYMENT_EVENTS.withdrawRequested, { ...basePayload, status: "PENDING" });
    eventBus.publish(PAYMENT_EVENTS.withdrawApproved, { ...basePayload, status: "APPROVED" });
    eventBus.publish(PAYMENT_EVENTS.withdrawRejected, { ...basePayload, status: "REJECTED" });

    await vi.waitFor(() => expect(enqueuedJobs.length).toBeGreaterThanOrEqual(3));
    const categories = enqueuedJobs.map((j) => j.payload.category).sort();
    expect(categories).toEqual(["WITHDRAW_APPROVED", "WITHDRAW_REJECTED", "WITHDRAW_REQUESTED"]);
  });

  it("affiliate.created broadcasts AFFILIATE_REQUESTED to admins and, when managerId is set, notifies that manager", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    recipients.setManagerForManagerId("manager-profile-1", "manager-user-1");
    await seedActiveSubscription(subscriptions, "admin-1");
    await seedActiveSubscription(subscriptions, "manager-user-1");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(AFFILIATE_EVENTS.created, {
      affiliateId: "aff-1",
      userId: "candidate-1",
      status: "PENDING",
      managerId: "manager-profile-1",
    });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "MANAGER_NETWORK_AFFILIATE_REQUESTED")).toBe(true));
    expect(enqueuedJobs.some((j) => j.payload.category === "AFFILIATE_REQUESTED")).toBe(true);
  });

  it("affiliate.created with managerId=null never notifies a manager (organic application, admin-only)", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    await seedActiveSubscription(subscriptions, "admin-1");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(AFFILIATE_EVENTS.created, { affiliateId: "aff-2", userId: "candidate-2", status: "PENDING", managerId: null });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "AFFILIATE_REQUESTED")).toBe(true));
    expect(enqueuedJobs.some((j) => j.payload.category === "MANAGER_NETWORK_AFFILIATE_REQUESTED")).toBe(false);
  });

  it("manager.invite.accepted broadcasts MANAGER_REQUESTED to admins", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    await seedActiveSubscription(subscriptions, "admin-1");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(MANAGER_EVENTS.inviteAccepted, { inviteId: "invite-1", userId: "candidate-manager-1" });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "MANAGER_REQUESTED")).toBe(true));
  });

  it("payments.gateway.unavailable broadcasts SYSTEM_CRITICAL_ALERT to admins", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    await seedActiveSubscription(subscriptions, "admin-1");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(PAYMENT_EVENTS.gatewayUnavailable, {
      gatewayCredentialId: "cred-1",
      provider: "MOCK",
      status: "OFFLINE",
      previousStatus: "ONLINE",
    });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "SYSTEM_CRITICAL_ALERT")).toBe(true));
  });

  it("notifications.daily_summary.generated broadcasts DAILY_SUMMARY to admins", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    await seedActiveSubscription(subscriptions, "admin-1");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(DAILY_SUMMARY_EVENTS.generated, {
      depositsTotalCents: 100,
      withdrawsTotalCents: 50,
      newPlayers: 1,
      newAffiliates: 0,
      newManagers: 0,
    });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "DAILY_SUMMARY")).toBe(true));
  });

  it("a disabled preference for a category prevents any job for that user/category, without affecting other admins", async () => {
    const { subscriptions, preferences, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1", "admin-2"]);
    await seedActiveSubscription(subscriptions, "admin-1");
    await seedActiveSubscription(subscriptions, "admin-2");
    await preferences.upsert("admin-1", "DEPOSIT_CONFIRMED", false);

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(PAYMENT_EVENTS.depositConfirmed, {
      depositId: "dep-4",
      userId: "player-1",
      amountCents: 100,
      gatewayCredentialId: "cred-1",
      status: "PAID",
    });

    await vi.waitFor(() => expect(enqueuedJobs.some((j) => j.payload.category === "DEPOSIT_CONFIRMED")).toBe(true));
    const recipients_ = enqueuedJobs.filter((j) => j.payload.category === "DEPOSIT_CONFIRMED");
    expect(recipients_).toHaveLength(1); // only admin-2's subscription, admin-1 opted out
  });

  it("sendTestNotification enqueues a TEST job for the given user's own devices only, never a broadcast to admins", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1", "admin-2"]); // present to prove sendTestNotification never fans out to them
    await seedActiveSubscription(subscriptions, "admin-1", "device-a");
    await seedActiveSubscription(subscriptions, "admin-1", "device-b");
    await seedActiveSubscription(subscriptions, "admin-2", "device-c");

    await dispatcher.sendTestNotification("admin-1");

    expect(enqueuedJobs).toHaveLength(2); // admin-1's two devices, nothing for admin-2
    expect(enqueuedJobs.every((j) => j.payload.category === "TEST")).toBe(true);
    expect(enqueuedJobs.every((j) => j.payload.title === "HelixCoin")).toBe(true);
    expect(enqueuedJobs.every((j) => j.payload.priority === "high")).toBe(true);
  });

  it("sendTestNotification for a user with no active subscription enqueues nothing (no crash)", async () => {
    const { enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    await dispatcher.sendTestNotification("admin-without-devices");
    expect(enqueuedJobs).toHaveLength(0);
  });

  it("an EXPIRED/REVOKED subscription never receives a job, only ACTIVE ones do", async () => {
    const { subscriptions, recipients, enqueuedJobs, dispatcher } = buildDispatcherTestHarness();
    recipients.setAdminUserIds(["admin-1"]);
    const active = await seedActiveSubscription(subscriptions, "admin-1", "device-active");
    const expired = await seedActiveSubscription(subscriptions, "admin-1", "device-expired");
    await subscriptions.updateStatus(expired.id, "EXPIRED");

    unsubscribe = dispatcher.subscribeToEvents();
    eventBus.publish(PAYMENT_EVENTS.withdrawRequested, {
      withdrawId: "wd-2",
      userId: "player-1",
      amountCents: 100,
      gatewayCredentialId: "cred-1",
      status: "PENDING",
    });

    await vi.waitFor(() => expect(enqueuedJobs.length).toBeGreaterThan(0));
    expect(enqueuedJobs).toHaveLength(1);
    expect(enqueuedJobs[0].subscriptionId).toBe(active.id);
  });
});
