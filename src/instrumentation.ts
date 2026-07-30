/**
 * Runs once when the Next.js server process starts, before any request is
 * handled (see node_modules/next/dist/docs/.../instrumentation.md — stable
 * in this version, no experimental flag needed).
 *
 * Why this file exists: src/modules/notifications/container.ts wires
 * NotificationDispatcherService.subscribeToEvents() as a module-load side
 * effect (same convention as affiliateContainer's
 * commissionService.subscribeToDeposits()) — but that only runs once
 * *something* actually imports the container. Every other module relying on
 * this pattern happens to get pulled in incidentally by an early request
 * (e.g. affiliateContainer via /r/[code]/route.ts).
 *
 * CAVEAT discovered while wiring the promotions/demo-bonus engine: this
 * file's module graph is its own isolated "instrumentation" compilation
 * layer, separate from the "route handler" layer that src/app/api/**\/route.ts
 * files (and the singletons they pull in, like @/server/events' eventBus)
 * actually run in. A subscription registered only through an `await
 * import(...)` here does NOT receive events published from inside a route
 * handler — confirmed by instrumenting both notifications and promotions:
 * neither reacted to a real depositConfirmed event even though this
 * register() had already run to completion. The imports below are kept as a
 * (harmless, currently non-functional for this exact purpose) safety net,
 * but the actual guaranteed wiring for anything that must react to payments
 * events now lives in src/modules/payments/container.ts, which route.ts
 * files always import — see the comment there.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // Prisma/BullMQ need the Node runtime, not edge.
  await import("@/modules/notifications/container");
  await import("@/modules/promotions/container");
}
