# Deploy na Hostinger — Passo a Passo (`helixcoin.fun`)

Guia prático, na ordem em que você realmente vai clicar/digitar, para
publicar o HeliJump na Hostinger usando o domínio `helixcoin.fun`. Para o
"porquê" de cada decisão de arquitetura (por que 3 zonas, um único app
Next.js, como o roteamento por host funciona) veja
[`DEPLOYMENT.md`](./DEPLOYMENT.md) — este arquivo é só o "como fazer" na
Hostinger especificamente.

**Pré-requisito de plano**: você precisa de um plano com **Node.js/VPS** na
Hostinger (não um plano de hospedagem compartilhada comum) — a aplicação é
um processo Node de longa duração (`next start`), não arquivos estáticos.

---

## 1. Configurar o domínio principal

1. No hPanel da Hostinger, confirme que `helixcoin.fun` está registrado e
   ativo na conta (Domínios → `helixcoin.fun`).
2. Se o domínio foi comprado em outro registrador e apontado para a
   Hostinger via nameservers, confirme que os nameservers da Hostinger
   (`ns1.dns-parking.com` / `ns2.dns-parking.com`, ou os que o hPanel
   indicar) já propagaram — sem isso, nenhum registro DNS abaixo tem
   efeito.

## 2. Criar os subdomínios

A aplicação não precisa que você "crie" os subdomínios como sites
separados no hPanel — eles são só registros DNS apontando para o mesmo
servidor (a separação real de zona/portal acontece dentro do código, por
`src/proxy.ts`, lendo o header `Host`). Mesmo assim, alguns planos da
Hostinger pedem que o subdomínio exista como entidade no painel antes de
você conseguir emitir SSL para ele:

1. hPanel → **Domínios** → `helixcoin.fun` → **Subdomínios**.
2. Criar `admin` (resultando em `admin.helixcoin.fun`).
3. Criar `manager` (resultando em `manager.helixcoin.fun`).
4. Criar `api` (resultando em `api.helixcoin.fun`).
5. Para cada um, quando o hPanel perguntar a pasta/diretório de destino,
   **não importa qual você escolher** — nenhum deles vai servir arquivos
   estáticos dali; é a mesma aplicação Node respondendo pelos 4 hosts (ver
   passo 5). Se o painel exigir uma pasta, aponte todos para a mesma pasta
   do projeto por simplicidade.

## 3. Apontar o DNS

hPanel → **Domínios** → `helixcoin.fun` → **Zona DNS**. Adicione (ou
confirme, se os passos acima já criaram automaticamente):

| Tipo  | Nome      | Valor                              | TTL      |
| ----- | --------- | ------------------------------------ | -------- |
| A     | `@`       | IP do seu servidor VPS               | Padrão   |
| CNAME | `admin`   | `helixcoin.fun.` (ou o mesmo IP, tipo A) | Padrão |
| CNAME | `manager` | `helixcoin.fun.` (ou o mesmo IP, tipo A) | Padrão |
| CNAME | `api`     | `helixcoin.fun.` (ou o mesmo IP, tipo A) | Padrão |

**Alternativa com wildcard** (mais simples de manter, cobre qualquer
subdomínio futuro automaticamente): em vez dos 3 `CNAME` individuais,
adicione um único registro `CNAME * → helixcoin.fun.` (ou `A * → <IP>`).
Qualquer uma das duas formas funciona identicamente para a aplicação.

Propagação de DNS pode levar de alguns minutos a algumas horas — confirme
com `nslookup admin.helixcoin.fun` (ou `dig`) antes de seguir para o SSL.

## 4. Configurar SSL/HTTPS

Com os 4 hosts resolvendo para o servidor:

- **Se o plano oferecer SSL wildcard automático** (comum em planos
  Business/Cloud da Hostinger): hPanel → **SSL** → ativar para
  `*.helixcoin.fun` + `helixcoin.fun`. Cobre `admin.`, `manager.` e `api.`
  automaticamente, renovação automática.
- **Se não**, via VPS com Certbot (Let's Encrypt):
  ```bash
  certbot --nginx \
    -d helixcoin.fun \
    -d admin.helixcoin.fun \
    -d manager.helixcoin.fun \
    -d api.helixcoin.fun
  ```
  (ou o certificado wildcard via desafio DNS, se preferir 1 certificado
  cobrindo tudo em vez de 4 nomes num certificado SAN).

Force redirecionamento HTTP→HTTPS na camada do Nginx/reverse proxy (passo
6) — a aplicação em si não faz esse redirect.

## 5. Cookies — SameSite e Secure em produção

Nenhuma configuração manual aqui — é tudo via variável de ambiente (passo
7) e já implementado em `src/server/auth/cookies.ts`:

- **`Secure`**: automaticamente `true` quando `NODE_ENV=production` — o
  cookie de sessão só trafega em HTTPS. É por isso que o passo 4 (SSL) tem
  que estar funcionando *antes* de testar login em produção.
- **`SameSite=Strict`**: sempre, em todo ambiente — bloqueia o cookie em
  qualquer requisição vinda de um site (domínio) diferente. É a defesa
  primária contra CSRF.
- **`Domain`**: configure `NEXT_PUBLIC_COOKIE_DOMAIN=.helixcoin.fun` (ver
  variáveis de ambiente, passo 7) para que a sessão seja reconhecida em
  qualquer uma das 3 zonas — é isso que permite ao middleware redirecionar
  automaticamente um jogador que acabou em `admin.helixcoin.fun` de volta
  para `helixcoin.fun`, sem precisar que ele tente logar lá primeiro.
  Compartilhar o cookie não dá acesso a nada — o controle de acesso real
  continua sendo o papel (role) do usuário, checado a cada requisição pelo
  middleware.

## 6. Reverse Proxy (Nginx) — se o VPS não gerenciar isso automaticamente

Se o plano VPS da Hostinger não tiver um proxy gerenciado embutido, instale
Nginx na frente do processo Node:

```nginx
server {
  listen 443 ssl;
  server_name helixcoin.fun admin.helixcoin.fun manager.helixcoin.fun api.helixcoin.fun;

  ssl_certificate     /etc/letsencrypt/live/helixcoin.fun/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/helixcoin.fun/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;              # CRÍTICO — é assim que src/proxy.ts decide a zona
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name helixcoin.fun admin.helixcoin.fun manager.helixcoin.fun api.helixcoin.fun;
  return 301 https://$host$request_uri;
}
```

`proxy_set_header Host $host;` é o único item realmente crítico dessa
configuração — se o `Host` original for reescrito ou omitido, a aplicação
não consegue mais saber qual zona (player/admin/manager) responder para
cada requisição.

## 7. Variáveis de ambiente de produção

No servidor (arquivo `.env` ao lado da aplicação, ou variáveis de ambiente
do processo/painel, dependendo de como o VPS foi configurado):

```bash
NODE_ENV="production"

DATABASE_URL="postgresql://..."      # seu Postgres de produção
REDIS_URL="redis://..."               # seu Redis de produção

JWT_ACCESS_SECRET="..."               # gerar novo, nunca reusar o de dev — openssl rand -base64 48
JWT_REFRESH_SECRET="..."              # idem
ENCRYPTION_KEY="..."                  # openssl rand -base64 32 (precisa decodificar para exatos 32 bytes)

# Zona (ver DEPLOYMENT.md para a explicação completa)
NEXT_PUBLIC_PLAYER_URL="https://helixcoin.fun"
NEXT_PUBLIC_ADMIN_URL="https://admin.helixcoin.fun"
NEXT_PUBLIC_MANAGER_URL="https://manager.helixcoin.fun"
NEXT_PUBLIC_API_URL="https://api.helixcoin.fun"
NEXT_PUBLIC_COOKIE_DOMAIN=".helixcoin.fun"

# CORS_ALLOWED_ORIGINS pode ficar vazio — o default seguro já cobre as 3
# URLs acima automaticamente (src/server/security/cors.ts), nunca "*".
```

Mais as demais variáveis já existentes do projeto (`WS_PORT`,
`UPLOADS_*`, `SENTRY_DSN`, etc.) — copie de `.env.example` e preencha com
os valores reais de produção.

## 8. Subir o projeto

```bash
# No servidor, dentro da pasta do projeto:
npm ci                    # instala exatamente as versões do package-lock.json
npm run db:migrate:deploy # prisma migrate deploy — aplica migrações pendentes
npm run build             # next build
npm start                 # next start — escuta na porta 3000 por padrão
```

Para manter o processo rodando (sobrevivendo a fechamento de SSH, reinícios
etc.), use um gerenciador de processo — PM2 é o mais comum:

```bash
npm install -g pm2
pm2 start npm --name helijump -- start
pm2 save
pm2 startup   # gera o comando para o PM2 iniciar sozinho no boot do servidor
```

Depois de subir, valide os 3 portais:

- `https://helixcoin.fun` → tela de login do jogador.
- `https://admin.helixcoin.fun` → tela de login do backoffice.
- `https://manager.helixcoin.fun` → tela de login do portal do gerente.
- `https://api.helixcoin.fun/api/health` → `{"data":{"status":"ok"}}` (ou
  equivalente) confirmando que a API responde.

## 9. Atualizar o projeto no futuro sem quebrar os subdomínios

O ponto chave: **é um único processo Node servindo os 4 hosts** — atualizar
o código é atualizar esse único processo, não 4 deploys separados. Os
subdomínios em si (DNS, SSL) não precisam de nenhum toque nas atualizações
seguintes, só a aplicação.

1. **Nunca rode `npm run build` direto na pasta que está servindo
   tráfego** — clone/puxe o código novo numa pasta separada (ex.
   `releases/<data>/` ou um novo `git pull` numa pasta paralela) e rode o
   build lá, sem afetar o processo em produção.
2. **Rode as migrações de banco *antes* de trocar o código**
   (`npm run db:migrate:deploy`) — e só com migrações que não quebrem a
   versão antiga do código, que continua rodando até a troca terminar.
3. **Troque o processo sem downtime**:
   - Com PM2: `pm2 reload helijump` (não `pm2 restart`) — inicia a nova
     versão antes de derrubar a antiga; se a nova falhar ao subir, o PM2
     mantém a antiga rodando.
   - Sem PM2: suba a build nova numa porta separada, valide com um smoke
     test manual, e só então troque o `proxy_pass` do Nginx (passo 6) para
     a porta nova antes de derrubar o processo antigo.
4. **Smoke test pós-deploy**: confirme os 3 logins (player/admin/manager),
   um redirecionamento de zona incorreta (ex. logar como jogador no
   formulário de `admin.helixcoin.fun` e confirmar que ele te manda de
   volta para `helixcoin.fun`), e `/api/health`.
5. **DNS e SSL não mudam entre deploys** — uma vez configurados (passos 3
   e 4), ficam válidos para sempre (SSL renova automaticamente via
   Certbot/painel); só o código e o processo Node mudam a cada versão.
6. **Rollback**: mantenha a pasta/release anterior intacta até confirmar
   que a nova está saudável — se algo quebrar, `pm2 reload` apontando de
   volta para a pasta antiga é o caminho mais rápido de reverter.

## Referência rápida

| O que                          | Onde                                              |
| ------------------------------- | -------------------------------------------------- |
| Arquitetura completa, cookies, CORS, CSP, SEO | [`DEPLOYMENT.md`](./DEPLOYMENT.md)  |
| Roteamento por host             | `src/proxy.ts`                                     |
| URLs de zona centralizadas      | `src/config/domains.ts`                            |
| Validação de variáveis de ambiente | `src/server/config/env.ts`                     |
| Cookies (Domain/SameSite/Secure/HttpOnly/Path) | `src/server/auth/cookies.ts`        |
| CORS                            | `src/server/security/cors.ts`                      |
| CSP e outros headers            | `next.config.ts`                                   |
