# HeliJump

Plataforma de skill game (estilo Helix Jump) com apostas em dinheiro real:
motor de jogo 3D próprio (física Rapier, torres proceduralmente geradas),
carteira/ledger, motor de partidas server-authoritative, pagamentos PIX,
programa de afiliados/gerentes, e um backoffice administrativo completo —
tudo servido por uma única aplicação Next.js dividida em 3 domínios
(Player, Admin, Gerente) por hostname.

## Visão geral

- **Player** (`helixcoin.bet` / `player.localhost:3000` em dev) — o jogo:
  cadastro, carteira, depósito/saque via PIX, partidas, indicações.
- **Admin** (`admin.helixcoin.bet` / `admin.localhost:3000`) — backoffice:
  usuários, RBAC, RTP/economia do jogo, financeiro, pagamentos, comercial
  (afiliados/gerentes), auditoria.
- **Manager** (`manager.helixcoin.bet` / `manager.localhost:3000`) — portal
  comercial para gerentes acompanharem e aprovarem sua rede de afiliados.

As três zonas são a **mesma aplicação Next.js** — a separação é feita por
`src/proxy.ts` lendo o header `Host` de cada requisição, não por deploys
separados. Veja [`DEPLOYMENT.md`](DEPLOYMENT.md) para a arquitetura completa
de domínios/subdomínios.

## Stack

| Camada          | Tecnologia                                                             |
| --------------- | ----------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router) + TypeScript, React 19                         |
| UI              | Tailwind CSS, Framer Motion                                            |
| 3D / Física     | React Three Fiber + Rapier (WASM)                                      |
| Banco de dados  | PostgreSQL + Prisma ORM                                                |
| Cache / Filas   | Redis + BullMQ                                                         |
| Autenticação    | JWT (access/refresh) próprio — `src/modules/identity`                  |
| Testes          | Vitest                                                                  |
| Lint / Format   | ESLint + Prettier + Husky (pre-commit) + Commitlint                    |
| Observabilidade | Pino (logs), Prometheus (`prom-client`), Sentry (opcional)             |
| Documentação API | OpenAPI 3.0 hand-authored, servido via Swagger UI em `/docs`          |

## Requisitos

- **Node.js 22+** (a CI usa Node 22 — veja `.github/workflows/ci.yml`)
- **Docker** (para Postgres + Redis locais via `docker-compose.yml`) — ou
  aponte `DATABASE_URL`/`REDIS_URL` para instâncias já existentes
- **npm** (o projeto usa `package-lock.json`, não pnpm/yarn)

## Instalação

```bash
git clone git@github.com:Rafalima01/helixcoin.git
cd helixcoin
cp .env.example .env        # preencha os valores — comentários no próprio arquivo
npm install
npm run docker:up           # Postgres + Redis (docker-compose.yml)
npm run db:migrate:deploy
npm run db:seed
```

## Desenvolvimento

```bash
npm run dev
```

`*.localhost` resolve para `127.0.0.1` nativamente em qualquer navegador/SO
moderno — nenhuma configuração de hosts file é necessária:

- Player: [http://player.localhost:3000](http://player.localhost:3000)
  (`http://localhost:3000` também funciona, mesma zona)
- Admin: [http://admin.localhost:3000](http://admin.localhost:3000)
- Gerente: [http://manager.localhost:3000](http://manager.localhost:3000)
- API docs (Swagger): [http://localhost:3000/docs](http://localhost:3000/docs)

Cada zona tem seu próprio `/login`, isolado por cookie (host-only em dev) —
não há como acessar uma zona pelo domínio de outra; o middleware
(`src/proxy.ts`) redireciona automaticamente para a zona correta.

## Produção

Guias completos e específicos por provedor:

- **[`DEPLOYMENT.md`](DEPLOYMENT.md)** — arquitetura de domínios,
  variáveis de ambiente por ambiente (dev/staging/produção), cookies,
  CORS, CSP, CSRF, SEO, DNS, SSL, e configuração recomendada tanto para
  Vercel quanto para Hostinger/VPS, incluindo rolling deploy.
- **[`HOSTINGER_DEPLOY.md`](HOSTINGER_DEPLOY.md)** — passo a passo
  específico para publicar na Hostinger usando o domínio `helixcoin.bet`.
- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — fundação de backend: stack,
  layout de `src/server/*`, convenção de módulo, convenções de banco.

Build e execução em produção seguem os comandos padrão do Next.js:

```bash
npm run build
npm start
```

## Deploy

O fluxo de branches segue:

```
develop → testes → merge → main → produção
```

- `main` — branch de produção, sempre estável e deployável.
- `develop` — branch de desenvolvimento; features são integradas aqui
  antes de seguir para `main`.

Nenhum deploy é automatizado neste repositório ainda — `.github/workflows/ci.yml`
roda a suíte de verificação (typecheck, lint, testes, build) em push/PR; a
publicação em si segue os passos manuais documentados em `DEPLOYMENT.md`/
`HOSTINGER_DEPLOY.md` até que um pipeline de CD seja configurado.

## Estrutura do projeto

```
src/
  app/            # Next.js App Router — páginas e rotas de API das 3 zonas
  components/      # Componentes React, organizados por área (game, admin, manager, wallet, ...)
  config/          # Configuração centralizada (ex.: src/config/domains.ts — URLs de zona)
  game-engine/      # Motor 3D do jogo (física, renderização, geração procedural)
  hooks/           # Hooks React (data fetching, estado de UI)
  lib/             # Utilitários e clientes de API do frontend
  modules/          # Módulos de domínio backend (identity, wallet, match-engine, payments, affiliate, manager, game-config, ...) — controller → service → repository
  server/          # Infraestrutura de servidor (auth, config, segurança, observabilidade, http, docs)
  store/           # Estado global (Zustand)
prisma/            # Schema, migrações e seed do banco
tests/             # Testes de integração (Vitest)
public/            # Assets estáticos
scripts/           # Processos auxiliares (worker BullMQ, servidor WebSocket)
```

Cada módulo de negócio em `src/modules/*` segue o mesmo padrão — veja
[`src/modules/_template/README.md`](src/modules/_template/README.md) para
a referência.

## Comandos úteis

| Comando                                               | O que faz                                     |
| ------------------------------------------------------ | ---------------------------------------------- |
| `npm run dev` / `build` / `start`                     | Next.js — desenvolvimento / build / produção  |
| `npm run worker`                                      | Processo worker (BullMQ)                      |
| `npm run ws`                                          | Servidor WebSocket                             |
| `npm run test` / `test:watch` / `test:coverage`       | Vitest                                         |
| `npm run lint` / `lint:fix` / `format`                | ESLint / Prettier                              |
| `npm run typecheck`                                   | `tsc --noEmit`                                 |
| `npm run docker:up` / `docker:down`                   | Postgres + Redis (+ Adminer, Redis Commander) |
| `npm run db:migrate` / `db:migrate:deploy` / `db:seed` / `db:studio` | Prisma (dev / produção / seed / GUI) |
