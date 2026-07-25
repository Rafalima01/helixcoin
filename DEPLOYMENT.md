# Deployment — Domínios, Ambientes e Produção

Este documento descreve como apontar produção (e, opcionalmente, um
ambiente de staging) para a arquitetura de 4 domínios já implementada em
código. **Nenhum DNS real foi alterado** — isto é só a preparação; quando os
registros forem apontados (ou os domínios adicionados na Vercel), a
aplicação já funciona sem mudança de código.

## Arquitetura

Um único projeto Next.js (nenhum monorepo) serve os quatro domínios. A
separação é feita inteiramente por **hostname**, em `src/proxy.ts` — o
middleware lê o header `Host` de cada requisição e decide qual "zona"
(player/admin/manager) atender, e a partir de qual role o visitante pode
acessá-la. `src/config/domains.ts` é a única fonte de verdade em código para
as 4 URLs de zona — todo link entre zonas (redirects do middleware, convites
de gerente/afiliado, o spec OpenAPI) importa dali; nada hardcoda um host.

| Domínio                        | Zona     | Quem acessa                                                                                                                          | Layout                                                    |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `https://helixcoin.fun`          | Player   | Jogadores (`role = USER`) — qualquer usuário autenticado hoje                                                                        | `src/components/app-shell` (jogo, intacto)                |
| `https://admin.helixcoin.fun`    | Admin    | Staff: `SUPER_ADMIN, ADMIN, FINANCE, OPERATOR, MODERATOR, SUPPORT, COMPLIANCE, AUDIT` (`ROLE_HIERARCHY`, `src/server/auth/rbac.ts`) | `AdminShell` — 100% corporativo, zero referência ao jogo   |
| `https://manager.helixcoin.fun`  | Manager  | `role = MANAGER`                                                                                                                      | `ManagerShell` — comercial, sem HUD/Wallet/Bottom Nav      |
| `https://api.helixcoin.fun`      | API      | Todas as zonas acima chamam `/api/**` — nenhuma interface gráfica                                                                   | Nenhum (só Route Handlers)                                 |

`src/app/admin/**` e `src/app/manager/**` continuam sendo os caminhos
internos reais das páginas — o middleware **reescreve** (`NextResponse.rewrite`,
invisível na barra de endereço) cada requisição em `admin.`/`manager.` para
dentro dessas árvores. O usuário nunca vê `/admin` ou `/manager` na URL, em
nenhum ambiente.

## O que o middleware já faz (`src/proxy.ts`)

1. **Roteamento por host** — `admin.` e `manager.` são reescritos para as
   árvores `/admin` e `/manager` já existentes; o domínio raiz continua
   servindo o app do jogador normalmente.
2. **Exclusividade real** — qualquer tentativa de acessar `/admin/**` ou
   `/manager/**` pelo domínio raiz é **redirecionada (308)** para o
   subdomínio correto, sem o prefixo (ex.: `helixcoin.fun/admin/users` →
   `admin.helixcoin.fun/users`).
3. **Gate de autenticação** — toda rota de `admin.`/`manager.` (exceto o
   próprio `/login` e, no caso do gerente, a página pública de aceite de
   convite) exige uma sessão válida.
4. **Gate de papel (role)** — além de autenticado, o papel precisa
   corresponder à zona:
   - `admin.` exige um papel de `ROLE_HIERARCHY` (staff). Um jogador ou
     gerente autenticado que tentar entrar é redirecionado para o `/login`
     da zona que **de fato** corresponde ao papel dele (jogador →
     `helixcoin.fun/login`; gerente → `manager.helixcoin.fun/login`) — nunca
     apenas bloqueado.
   - `manager.` exige `role = MANAGER`; um membro do staff é redirecionado
     para `admin.helixcoin.fun/login`, um jogador para `helixcoin.fun/login`.
   - Um visitante **não autenticado** continua indo para o login da própria
     zona que tentou acessar (comportamento inalterado).
5. **`/api/**` nunca é reescrito nem bloqueado por host** — funciona
   identicamente em qualquer um dos quatro domínios (ver seção API abaixo).

## Variáveis de ambiente

`src/config/domains.ts` é a fonte de verdade em código; `src/server/config/env.ts`
declara e valida (Zod) os mesmos nomes para falhar rápido no boot se algo
estiver malformado. Nunca hardcode um host em código novo — importe de
`@/config/domains`.

```bash
NEXT_PUBLIC_PLAYER_URL=https://helixcoin.fun
NEXT_PUBLIC_ADMIN_URL=https://admin.helixcoin.fun
NEXT_PUBLIC_MANAGER_URL=https://manager.helixcoin.fun
NEXT_PUBLIC_API_URL=https://api.helixcoin.fun
NEXT_PUBLIC_COOKIE_DOMAIN=.helixcoin.fun
```

- Prefixo `NEXT_PUBLIC_` de propósito: são só URLs base (nunca segredos) e
  precisam estar disponíveis tanto no servidor (`src/proxy.ts`, os
  controllers que montam links entre zonas) quanto no navegador.
- `NEXT_PUBLIC_COOKIE_DOMAIN` fica **vazio em dev/staging** (cookies
  host-only, isoladas por zona) e é `.helixcoin.fun` **em produção**
  (cookie compartilhado entre as três zonas) — ver seção "Cookies entre
  subdomínios" abaixo para o porquê.

### Valores por ambiente

Mesmas 5 variáveis, valores diferentes por ambiente — configuradas no painel
de variáveis do provedor (Vercel tem um conjunto por Environment:
Production/Preview/Development; um VPS/Hostinger usa `.env` por servidor).

| Variável                     | Development                        | Staging (exemplo)                              | Production                          |
| ----------------------------- | ----------------------------------- | ------------------------------------------------ | ------------------------------------- |
| `NEXT_PUBLIC_PLAYER_URL`      | `http://player.localhost:3000`      | `https://staging.helixcoin.fun`                    | `https://helixcoin.fun`                |
| `NEXT_PUBLIC_ADMIN_URL`       | `http://admin.localhost:3000`       | `https://admin.staging.helixcoin.fun`              | `https://admin.helixcoin.fun`          |
| `NEXT_PUBLIC_MANAGER_URL`     | `http://manager.localhost:3000`     | `https://manager.staging.helixcoin.fun`            | `https://manager.helixcoin.fun`        |
| `NEXT_PUBLIC_API_URL`         | `http://api.localhost:3000`         | `https://api.staging.helixcoin.fun`                | `https://api.helixcoin.fun`            |
| `NEXT_PUBLIC_COOKIE_DOMAIN`   | *(vazio)*                           | *(vazio, ou `.staging.helixcoin.fun` — ver seção Cookies)* | `.helixcoin.fun`         |
| `CORS_ALLOWED_ORIGINS`        | *(vazio — default seguro cobre isso)* | 3 URLs de staging acima, separadas por vírgula  | *(vazio — default seguro cobre isso)* |

- **Development** (já funciona, nenhuma configuração extra): `*.localhost`
  resolve para `127.0.0.1` em todo navegador/SO moderno, sem editar hosts
  file. `player.localhost` (e não `localhost` puro) é usado como origem
  canônica do jogador em dev por uma particularidade desta versão do
  Next.js: o roteador de dev calcula a "origem" da requisição a partir do
  próprio endereço em que o servidor está ligado (`localhost:3000`) em vez
  do header `Host` real recebido, sem opção suportada em `next.config` para
  desativar isso — então uma origem de player igual a `localhost:3000`
  colidiria com essa origem sintética e o Next relativizaria silenciosamente
  o header `Location` de qualquer redirect construído a partir dela (era
  exatamente o bug do redirect de papel incorreto entre zonas). `localhost:3000`
  puro continua servindo a zona do jogador normalmente (é a branch padrão do
  host em `src/proxy.ts`) — só a URL canônica/gerada mudou. Não afeta outros
  ambientes (lá cada zona já é um domínio real distinto).
- **Staging**: um deploy persistente (não um Preview efêmero) precisa de
  DNS/subdomínios próprios se quiser testar a separação de zonas de ponta a
  ponta — veja a tabela acima como ponto de partida. Se estiver usando
  Preview Deployments da Vercel em vez disso, cada preview já ganha seu
  próprio host único automaticamente (não há como replicar 3 subdomínios
  fixos por preview); nesse caso teste localmente (dev) para o fluxo
  multi-zona e use Preview apenas para validar a build.
- **Production**: os 4 domínios reais, `NEXT_PUBLIC_COOKIE_DOMAIN=.helixcoin.fun`
  (ver seção seguinte) — nenhuma outra mudança de código é necessária além
  de apontar essas variáveis.

## Cookies entre subdomínios

Cada zona seta seu próprio cookie de sessão (`hj_access_token`/
`hj_refresh_token`, `src/server/auth/cookies.ts`) com estes atributos:

| Atributo   | Dev/Staging (default)                          | Produção                        | Por quê                                                                                          |
| ---------- | ----------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Domain`   | *(omitido)* — `NEXT_PUBLIC_COOKIE_DOMAIN` vazio | `.helixcoin.fun`                 | Ver explicação abaixo — em dev o cookie é host-only (isolamento total); em produção é compartilhado entre `helixcoin.fun`, `admin.helixcoin.fun` e `manager.helixcoin.fun`. |
| `Secure`   | `false`                                          | `true`                            | Em dev, `http://*.localhost` não tem TLS; em produção o cookie nunca deve trafegar fora de HTTPS. |
| `SameSite` | `Strict`                                        | `Strict`                          | Bloqueia o cookie em qualquer requisição cross-**site** (domínio de terceiro) — é a defesa primária contra CSRF (ver seção abaixo). Independente do `Domain` acima: `helixcoin.fun` e seus subdomínios são sempre o mesmo "site" para efeito de `SameSite`. |
| `HttpOnly` | `true`                                          | `true`                            | Nunca legível por JS no navegador (mitigação de XSS).                                             |
| `Path`     | `/`                                              | `/`                                | Válido para toda a zona, não só a rota que o criou.                                               |

**Por que `Domain` é diferente em produção.** Em dev o cookie fica
host-only (isolamento total: um cookie criado em `player.localhost` nunca é
sequer *visto* por `admin.localhost`) — comportamento já validado e mantido
sem mudança. Em **produção**, `NEXT_PUBLIC_COOKIE_DOMAIN=.helixcoin.fun`
compartilha o cookie entre as três zonas, o que é o que a fase pediu com
"autenticação entre subdomínios"/"cookies compartilhados": o middleware
(`src/proxy.ts`) consegue reconhecer uma sessão de qualquer zona assim que
o navegador visita outra, e redirecionar automaticamente para a zona
correta — sem exigir que o visitante primeiro tente logar manualmente na
zona errada para o gate de papel entrar em ação. Isso é seguro porque
**compartilhar o cookie não é o mesmo que autorizar acesso**: o gate de
papel do middleware (`hasRole(...)`/`role === "MANAGER"`) continua sendo a
barreira real — uma sessão de jogador visível em `admin.helixcoin.fun`
ainda é redirecionada para fora de lá, só que automaticamente em vez de
precisar de uma tentativa de login primeiro.

"Mas todos utilizam autenticação compartilhada quando permitido" também se
refere ao **backend**: mesmas chaves JWT, mesma tabela de usuários, mesmo
endpoint de login em cada zona (`/login` local chamando a mesma API). Uma
conta de jogador consegue logar tanto em `helixcoin.fun/login` quanto (com
sucesso de autenticação, mas falha no gate de papel) em
`admin.helixcoin.fun/login`; o middleware redireciona para a zona correta
em qualquer um dos dois casos — a checagem acontece no servidor a cada
request, não depende de o navegador já "saber" o papel do usuário antes de
perguntar.

Nenhuma mudança de código foi necessária para isso — `src/server/auth/cookies.ts`
já lê `COOKIE_DOMAIN` (`src/config/domains.ts`) e aplica o atributo
`Domain` condicionalmente; é só a variável de ambiente de produção que
passa a ter um valor em vez de ficar vazia. Em staging, deixe vazio (ou use
`.staging.helixcoin.fun` se o staging tiver seus próprios 3 subdomínios) —
comportamento equivalente ao dev.

## CORS

`src/server/security/cors.ts` (`withCors`/`handleCorsPreflight`, usado por
Route Handlers pensados para consumo cross-origin — apps mobile,
integrações de parceiro) usa uma allowlist explícita, nunca `Access-Control-Allow-Origin: *`:

- Se `CORS_ALLOWED_ORIGINS` (comma-separated) estiver definida, ela vence.
- Caso contrário, o default é exatamente as três origens de zona
  (`NEXT_PUBLIC_PLAYER_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_MANAGER_URL`,
  via `src/config/domains.ts`) — cobrindo "Player↔API, Admin↔API,
  Manager↔API" automaticamente em qualquer ambiente, sem precisar configurar
  nada extra.

Chamadas same-origin (cada zona chamando seu próprio `/api/**`, que é o
padrão hoje — ver seção API abaixo) nunca passam por CORS; isso só entra em
jogo se/quando algo chamar `api.helixcoin.fun` de um browser fora dessas três
origens.

## CSRF

A defesa primária já está em vigor: os cookies de sessão são `SameSite=Strict`
(ver "Cookies entre subdomínios" acima), o que por si só bloqueia o vetor
clássico de CSRF — o navegador nunca anexa o cookie numa requisição
disparada por um site (domínio de terceiro) diferente. `src/server/security/csrf.ts`
implementa double-submit-cookie como infraestrutura de defesa em
profundidade, disponível para qualquer rota autenticada por cookie adotar;
nenhuma rota usa hoje porque não é necessário. Isso funciona igual em
qualquer uma das três zonas e independe do `Domain` do cookie (host-only em
dev, compartilhado em produção) — `SameSite` julga a relação entre o site
que iniciou a requisição e o site do cookie, não quais hosts enxergam o
cookie; um pedido forjado a partir de um domínio de terceiro nunca carrega
o cookie em nenhum dos dois casos, e uma navegação entre nossas próprias
três zonas nunca é uma tentativa de forjar nada.

## CSP (Content-Security-Policy)

`next.config.ts`'s `headers()` aplica um `Content-Security-Policy` real
(além dos headers de hardening já existentes — `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), igual
para as 4 zonas:

```
# Produção:
default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
font-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'

# Dev (NODE_ENV=development) — mesma política, script-src ganha 'unsafe-eval':
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'
```

- `'self'` cobre tudo por padrão porque a aplicação não depende de nenhum
  CDN/origem externa: `next/font` auto-hospeda as fontes no build, o
  Swagger UI (`/docs`) é vendored em `public/swagger-ui`, e o WASM do motor
  de física (`@react-three/rapier`) é empacotado como asset same-origin.
- `'unsafe-inline'` em `script-src`/`style-src` é necessário para o script
  de hidratação inline do Next.js e para estilos inline do Tailwind/
  framer-motion — não há wiring de nonce nesta fase (mudaria o
  comportamento de qualquer inline script/style existente sem necessidade
  de negócio; ficou fora de escopo aqui).
- `'wasm-unsafe-eval'` é necessário para o motor de física compilar
  WebAssembly.
- `'unsafe-eval'` (script-src) é adicionado **só em dev** — o Turbopack HMR
  e a reconstrução de callstack do React em modo dev usam `eval()` puro;
  produção nunca precisa disso e não ganha essa permissão.
- `frame-ancestors 'none'` é o equivalente em CSP do `X-Frame-Options: DENY`
  já existente (mantido para navegadores mais antigos).
- `connect-src` inclui `ws:`/`wss:` para o WebSocket próprio da aplicação
  (`scripts/ws-server.ts`, `WS_PORT`).

Nenhuma variável de ambiente controla o CSP — é estático porque não há
origem externa variável por ambiente para permitir.

## SEO

- **Player** (`src/app/layout.tsx`): `metadataBase` (usa `NEXT_PUBLIC_PLAYER_URL`),
  Open Graph, Twitter Card, `canonical`, favicon/ícones e manifest PWA já
  configurados. `src/app/robots.ts` e `src/app/sitemap.ts` (novos) publicam
  `/robots.txt` e `/sitemap.xml` permitindo indexação das páginas públicas
  (`/`, `/login`, `/signup`) e bloqueando páginas autenticadas
  (`/home`, `/play`, `/wallet`, `/profile`, `/deposit`, `/withdraw`,
  `/referrals`, `/api`, `/docs`).
- **Admin/Manager** (`src/app/admin/layout.tsx`, `src/app/manager/layout.tsx`):
  já tinham `robots: { index: false, follow: false }` na metadata de cada
  página — nenhum motor de busca indexa essas zonas. `src/app/robots.ts`
  reforça isso: como o mesmo arquivo responde por qualquer host (o matcher
  do `src/proxy.ts` exclui caminhos com ponto, incluindo `/robots.txt`, do
  seu rewrite por zona), ele lê o header `Host` real em tempo de requisição
  e devolve `Disallow: /` para qualquer host que comece com `admin.` ou
  `manager.` — dupla proteção (meta tag por página + robots.txt por host).

## DNS

Quatro registros, todos apontando para o **mesmo** servidor/IP (é a mesma
aplicação Next.js respondendo por todos) — isto é para o cenário Hostinger/VPS
com reverse proxy próprio. Para Vercel, ver a seção dedicada abaixo (lá cada
domínio é adicionado no painel, não é um CNAME manual para um IP).

| Tipo    | Nome      | Aponta para                          |
| ------- | --------- | ------------------------------------- |
| A/CNAME | `@`       | IP do servidor / hostname do host     |
| CNAME   | `admin`   | mesmo destino de `@` (ou o próprio `helixcoin.fun`) |
| CNAME   | `manager` | mesmo destino de `@`                  |
| CNAME   | `api`     | mesmo destino de `@`                  |

**Alternativa com wildcard**: em vez dos 3 registros `CNAME` individuais
(`admin`, `manager`, `api`), um único `CNAME *` (ou `A *` apontando para o
mesmo IP) cobre qualquer subdomínio presente e futuro de `helixcoin.fun` —
simplifica a gestão do DNS à custa de menos controle por subdomínio
individual (ex.: não dá para apontar um subdomínio específico para outro
lugar sem uma exceção mais específica, que tem precedência sobre o
wildcard). Qualquer uma das duas abordagens funciona identicamente para a
aplicação — é só uma escolha de como gerenciar o DNS.

Não é necessário nenhum registro MX/TXT adicional para esta arquitetura
(fora do que já existe para e-mail, se houver).

## SSL

Como os quatro hosts respondem pelo mesmo servidor, um **certificado
wildcard** (`*.helixcoin.fun` + `helixcoin.fun`) é o caminho mais simples —
cobre `admin.`, `manager.` e `api.` automaticamente, sem emitir/renovar 4
certificados separados. Alternativas equivalentes:

- 4 certificados individuais (um por host) via Let's Encrypt/Certbot.
- Certificado gerenciado pelo próprio painel da Hostinger, se o produto
  contratado oferecer wildcard SSL automático.
- Na Vercel, SSL é automático por domínio adicionado (Let's Encrypt gerenciado
  pela própria plataforma) — ver seção Vercel abaixo, nada manual.

Em qualquer caso (fora da Vercel), force HTTPS (redirect 80→443) na camada
do proxy/servidor web — a aplicação em si não faz esse redirect.

## Redirects

Nenhum redirect adicional precisa ser configurado no DNS/proxy reverso além
do roteamento de host para o mesmo servidor — **toda a lógica de
exclusividade e redirecionamento por papel já vive em `src/proxy.ts`** (ver
seção acima). O reverse proxy só precisa entregar a requisição, com o
header `Host` original preservado, para a aplicação Next.js.

## Reverse Proxy (Hostinger/VPS)

Se o deploy usar Nginx (ou similar) na frente da aplicação Next.js (comum
em VPS), a configuração é a mesma para os 4 hosts — todos apontam para o
mesmo `upstream`, o middleware é quem diferencia por `Host`:

```nginx
server {
  listen 443 ssl;
  server_name helixcoin.fun admin.helixcoin.fun manager.helixcoin.fun api.helixcoin.fun;

  ssl_certificate     /etc/letsencrypt/live/helixcoin.fun/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/helixcoin.fun/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;              # crítico — proxy.ts decide a zona por este header
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

O ponto crítico é `proxy_set_header Host $host;` — se o reverse proxy
reescrever ou omitir o header `Host` original, `src/proxy.ts` perde a
informação de qual zona servir.

## Configuração recomendada para Hostinger

Resumo rápido — o passo a passo completo (domínio, subdomínios, DNS, SSL,
subir o projeto e publicar novas versões sem quebrar os subdomínios) está
em **[`HOSTINGER_DEPLOY.md`](./HOSTINGER_DEPLOY.md)**.

1. **Apontar os 4 registros DNS** (tabela acima) para o servidor/IP do
   plano Node.js/VPS contratado.
2. **Emitir o SSL** — se o plano oferecer wildcard automático, ativá-lo
   para `*.helixcoin.fun`; caso contrário, gerar via Certbot no VPS
   (`certbot --nginx -d helixcoin.fun -d admin.helixcoin.fun -d manager.helixcoin.fun -d api.helixcoin.fun`,
   ou o certificado wildcard via desafio DNS).
3. **Uma única aplicação Node** — `npm run build && npm run start`
   (ou via PM2/processo gerenciado pelo painel), escutando numa porta
   interna (ex. 3000); o reverse proxy da Hostinger (ou o Nginx acima)
   direciona os 4 hosts para essa mesma porta.
4. **Variáveis de ambiente de produção** — configurar todas as já
   existentes (`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `ENCRYPTION_KEY` etc.)
   mais as 5 `NEXT_PUBLIC_*` desta fase, com os domínios reais e
   `NEXT_PUBLIC_COOKIE_DOMAIN=.helixcoin.fun`.
5. **Nada de rotas/paths especiais no painel** — não é preciso criar 4
   "sites" separados; é um projeto Node único recebendo tráfego de 4
   hostnames.

## Configuração recomendada para Vercel

Vercel é o caminho mais simples para os 3 domínios com frontend (Player,
Admin, Manager) — `api.helixcoin.fun` continua sendo a mesma aplicação
(nenhum deploy separado; ver seção API), então só precisa ser adicionado
como mais um domínio do mesmo projeto.

1. **Um único projeto Vercel** (mesmo repositório, sem monorepo) — não crie
   3 projetos separados; o roteamento por zona é feito pelo `src/proxy.ts`
   em runtime, não por build separado.
2. **Adicionar os domínios** (Project → Settings → Domains):
   - `helixcoin.fun` (domínio principal/primário do projeto)
   - `admin.helixcoin.fun`
   - `manager.helixcoin.fun`
   - `api.helixcoin.fun`

   Todos os 4 apontam para o **mesmo** projeto/deployment — a Vercel já
   preserva o header `Host` original ao rotear (equivalente ao
   `proxy_set_header Host $host` do Nginx), então `src/proxy.ts` recebe o
   host correto sem nenhuma configuração adicional.
3. **DNS**: a Vercel indica, por domínio adicionado, se deve ser um
   registro `A` (para o apex `helixcoin.fun`, apontando para o IP da
   Vercel) ou `CNAME` (para os subdomínios `admin`/`manager`/`api`,
   apontando para `cname.vercel-dns.com`) — siga exatamente o que o painel
   mostrar para cada domínio, os valores podem mudar entre contas/planos.
4. **SSL**: automático — a Vercel emite e renova certificado Let's Encrypt
   por domínio assim que o DNS propaga; nada manual.
5. **Variáveis de ambiente por Environment**: o painel da Vercel tem 3
   conjuntos (Production / Preview / Development). Configure as 5
   `NEXT_PUBLIC_*` desta fase (+ todas as já existentes — `DATABASE_URL`,
   `JWT_*` etc.) em **Production** com os domínios reais; **Preview** pode
   herdar os mesmos valores de Production se não houver um staging
   persistente dedicado (Preview Deployments não têm subdomínios fixos por
   natureza — cada preview ganha uma URL única gerada pela Vercel, então a
   separação de zonas por hostname não se replica ali; teste o fluxo
   multi-zona localmente ou num staging persistente separado, como
   descrito na tabela de ambientes acima).
6. **Build**: a Vercel detecta Next.js automaticamente e roda
   `npm run build` — nenhum ajuste de `vercel.json` é necessário para o
   roteamento por zona (é tudo `src/proxy.ts`, que a Vercel já executa como
   Edge/Node Middleware nativamente). O `output: "standalone"` do
   `next.config.ts` (pensado para o Docker/Hostinger) não atrapalha o
   build na Vercel — ela ignora esse modo e usa seu próprio empacotamento.

## Build

Os três comandos padrão do Next.js continuam funcionando sem qualquer
configuração extra em qualquer um dos três hosts de deploy (dev local,
Hostinger/VPS, Vercel):

```bash
npm run dev     # dev server, Turbopack, *.localhost — ver seção "Desenvolvimento local"
npm run build   # next build — mesmo build serve as 4 zonas, roteadas por src/proxy.ts em runtime
npm start       # next start — só necessário fora da Vercel (Hostinger/VPS); a Vercel gerencia isso
```

## Publicação de novas versões / Rolling deploy (zero downtime)

**Na Vercel**: já é zero-downtime por padrão, sem passo manual. Cada deploy
é atômico — a build nova só recebe tráfego depois de pronta e saudável; a
anterior continua servindo até a troca, e um rollback é instantâneo (re-
apontar o alias de produção para o deployment anterior no painel ou via
`vercel rollback`). Isso vale para os 4 domínios simultaneamente, já que são
o mesmo projeto/deployment.

**Em Hostinger/VPS** (processo Node gerenciado por PM2, ou equivalente):

1. **Migrações de banco primeiro, sempre backward-compatible** — rode
   `npm run db:migrate:deploy` (`prisma migrate deploy`) *antes* de trocar o
   código em produção, e só com migrações aditivas (novas colunas
   opcionais/nullable, novas tabelas) nesta fase — nenhuma migração é
   necessária aqui, mas a prática vale para toda mudança futura: a versão
   antiga do código precisa continuar funcionando contra o schema novo até
   a troca terminar.
2. **Build em paralelo** — rode `npm run build` num diretório/release novo
   (ex. `releases/<timestamp>/`), sem tocar no processo que está servindo
   tráfego.
3. **Troca atômica do processo**:
   - PM2: `pm2 reload helijump` (não `restart`) — inicia o processo novo
     antes de derrubar o antigo, sem gap de indisponibilidade, e faz
     rollback automático se o novo processo falhar ao subir.
   - Alternativa sem PM2: subir a build nova numa porta separada (ex.
     3001), validar com um smoke test local, e só então trocar o
     `proxy_pass` do Nginx para a porta nova e derrubar a antiga
     (blue-green manual).
4. **Smoke test pós-deploy** — confirmar os 3 portais (login Player/Admin/
   Manager, um redirecionamento de zona incorreta, um health check de
   `/api/health`) antes de considerar o deploy concluído.
5. **Rollback**: manter a `release/` anterior intacta (não sobrescrever) —
   se o smoke test falhar, `pm2 reload` apontando de volta para o release
   anterior é a saída mais rápida.

## API (`api.helixcoin.fun`)

Hoje cada zona já chama `/api/**` da **própria origem** (fetch relativo —
ex. o admin chama `admin.helixcoin.fun/api/admin/users`), o que já
funciona porque `src/proxy.ts` exclui `/api` do seu matcher para todo host
(`config.matcher`). Isso significa que **nenhuma mudança de código foi
necessária** para `api.helixcoin.fun` responder — o mesmo Next.js já serve
`/api/**` idêntico não importa o host.

`api.helixcoin.fun` existe como **ponto de entrada documentado e estável**
para uso externo (webhooks de gateway de pagamento, integrações, Swagger —
ver `API_URL` em `src/config/domains.ts`, usado pelo spec OpenAPI em
`src/server/docs/openapi.ts`), não como uma migração das chamadas internas
do frontend (que continuam same-origin por zona). Se um dia o frontend
precisar chamar `api.helixcoin.fun` diretamente de forma cross-origin, isso
já tem cobertura de CORS pronta (ver seção CORS acima) — nenhuma
configuração adicional necessária além de, se os domínios reais divergirem
dos 3 padrões, setar `CORS_ALLOWED_ORIGINS` explicitamente.

## Compatibilidade

Nada em Wallet, Ledger, RTP, Match Engine, Pagamentos, Comercial,
Afiliados, Gerentes, Notificações, Permissões ou Swagger foi alterado nesta
fase — as mudanças são inteiramente de roteamento/middleware/variáveis de
ambiente/cookies/CORS/SEO. Todas as regras de negócio, cálculos e endpoints
continuam exatamente como estavam. Nenhuma migração de banco foi necessária.

## Desenvolvimento local (recapitulando)

```bash
npm run dev
```

- Jogador: `http://player.localhost:3000` (ou `http://localhost:3000` — equivalente, ver nota acima)
- Admin: `http://admin.localhost:3000`
- Gerente: `http://manager.localhost:3000`
- API: `http://api.localhost:3000/api/health` (ou simplesmente
  `http://localhost:3000/api/health` — funciona em qualquer host)

Nenhum hosts file ou configuração extra é necessária — `*.localhost`
resolve para `127.0.0.1` nativamente.
