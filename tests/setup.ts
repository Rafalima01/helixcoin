/**
 * Global Vitest setup. Runs once before the test suite. Keep this free of
 * side effects that would make tests order-dependent — per-test setup
 * belongs in the test file or a fixture in tests/helpers.
 */
// `NODE_ENV` is typed readonly by @types/node — Object.assign bypasses that
// without an `any` cast.
Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? "test" });
