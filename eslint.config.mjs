import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Backend infra ignores:
    "coverage/**",
    ".husky/**",
    // Vendored, unminified-by-us static assets (Swagger UI bundle) — not
    // source we own or want linted/formatted.
    "public/swagger-ui/**",
  ]),
  {
    // The React Compiler readiness rules assume components never mutate
    // refs/external objects outside the render phase. The game engine
    // intentionally mutates refs and a shared drag-state object inside
    // useFrame — the standard react-three-fiber pattern for avoiding
    // per-frame React re-renders in a 60fps loop. React Compiler isn't
    // enabled in this project, so these mutations are safe at runtime.
    files: ["src/components/game/**/*.{ts,tsx}", "src/game-engine/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      // The engine runtime object holds a RigidBody ref so physics systems
      // can read it inside useFrame — it is never dereferenced during render.
      "react-hooks/refs": "off",
    },
  },
  // Must be last: disables stylistic rules that would fight Prettier.
  prettierConfig,
]);

export default eslintConfig;
