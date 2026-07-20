# HeliJump

A skill-based Helix Jump platform: a from-scratch 3D game engine (Rapier
physics, procedural towers), a player app (wallet, referrals, profile), and
an enterprise admin backoffice — built on Next.js (App Router) +
TypeScript.

## Getting started

```bash
cp .env.example .env        # fill in secrets — see comments in the file
npm install
npm run docker:up           # Postgres + Redis (docker-compose.yml)
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the player app,
[http://localhost:3000/admin](http://localhost:3000/admin) for the
backoffice, and [http://localhost:3000/docs](http://localhost:3000/docs)
for the API reference.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — backend foundation: stack,
  `src/server/*` layout, the module convention, database conventions, what
  has and hasn't been runtime-verified.
- **[src/modules/\_template/README.md](src/modules/_template/README.md)** —
  the module pattern (controller → service → repository) every future
  business module follows, with a working, tested reference
  implementation to copy.

## Scripts

| Command                                               | What it does                                  |
| ----------------------------------------------------- | --------------------------------------------- |
| `npm run dev` / `build` / `start`                     | Next.js app                                   |
| `npm run worker`                                      | BullMQ worker process                         |
| `npm run ws`                                          | WebSocket server process                      |
| `npm run test` / `test:watch` / `test:coverage`       | Vitest                                        |
| `npm run lint` / `format`                             | ESLint / Prettier                             |
| `npm run typecheck`                                   | `tsc --noEmit`                                |
| `npm run docker:up` / `docker:down`                   | Postgres + Redis (+ Adminer, Redis Commander) |
| `npm run db:migrate:deploy` / `db:seed` / `db:studio` | Prisma                                        |
