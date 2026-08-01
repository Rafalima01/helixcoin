# HeliJump — Direção de Arte & Plano de Execução Visual

> Documento de referência. Escopo: frontend do jogador. Nada aqui foi implementado — é o plano completo para aprovação por etapas, derivado da auditoria de UI/UX anterior.
> Todas as recomendações foram checadas contra o código real do projeto (`globals.css`, `button.tsx`, `card.tsx`, `package.json`, `layout.tsx`) em 2026-07-31 para evitar propor algo que já existe ou que conflite com o que já existe.

---

## 0. O que já existe hoje (ponto de partida real, não hipotético)

Antes de propor qualquer coisa nova, isto já está no projeto e será a base de tudo abaixo:

- **Tokens de cor** em `src/app/globals.css` (`:root` + `@theme inline`): `--color-primary` (roxo), `--color-gold`/`--color-gold-bright`/`--color-gold-dim`, `--color-positive`, `--color-danger`, `--color-surface`/`--color-surface-elevated`, `--color-glow`.
- **Tipografia**: Inter (`--font-sans`, corpo/UI) e Baloo 2 (`--font-display`, headlines/multiplicador/CTAs), carregadas via `next/font/google` em `src/app/layout.tsx`. Ambas já self-hosted (sem chamada externa).
- **Radius/Shadow**: `--radius-card: 20px`, `--radius-btn: 14px`, `--shadow-button`.
- **Utilitários reutilizáveis**: `.glass-card`, `.glass-panel`, `.text-gradient-brand/green/gold`, `.glow-purple/pink/green/gold`, `.shimmer-bg`, `.noise-overlay` (ruído SVG inline, já aplicado no body inteiro).
- **`Button`** (`src/components/ui/button.tsx`): `cva` com variants `primary/gold/arcade/secondary/success/danger/ghost/outline`, sizes `sm/md/lg/icon`, já usa `framer-motion` para hover/tap.
- **`Card`** (`src/components/ui/card.tsx`): variants `surface` (padrão, usado em tudo hoje) e `arcade` (dourado, já existe no código, **zero telas usam ainda**).
- **Outros primitivos já prontos**: `Input`, `Modal`, `Badge`, `Skeleton`, `AnimatedNumber`, `Logo`.
- **Dependências já instaladas** (não precisam ser adicionadas): `framer-motion@12`, `canvas-confetti@1.9` (já usado em `victory-overlay.tsx`), `lucide-react`, `class-variance-authority`, `@react-three/fiber` + `drei` + `postprocessing` (motor 3D do jogo).
- **Componente órfão pronto para reaproveitar**: `src/components/landing/live-ticker.tsx` — ticker de ganhadores com prop `compact`, nunca integrado a nenhuma tela.

Todo o plano abaixo é construído **em cima** disso — não substitui nada que já funciona.

---

## 1. Arte e Ilustração Proprietária

### Como isso entra no fluxo do projeto
Hoje não existe um passo de "arte" no fluxo — os banners (`public/auth-banner-*.webp`, `public/home-banner-*.webp`) foram encomendados/gerados avulsos, sem um brief de estilo compartilhado, o que é a causa raiz do problema A/B da auditoria (3 estilos de arte diferentes, banner de login com conteúdo errado). O fluxo proposto:

1. **Brief único de estilo** (documento curto, não este arquivo): paleta (os tokens da seção 0), nível de estilização (3D semi-realista, como o hero atual — não fotografia, não flat 2D), iluminação (glow roxo/dourado consistente com `--color-glow`/`--color-gold-bright`), um "mascote" ou motivo visual recorrente (a esfera/torre já usada no hero é o candidato natural — reaproveitar em vez de introduzir um mascote novo, que criaria um 4º estilo).
2. Qualquer asset novo (banner, ilustração, ícone) é encomendado **contra esse brief**, seja a um freelancer/estúdio, seja gerado, e só entra no repositório depois de aprovado visualmente contra os outros assets já existentes lado a lado.
3. Todos os assets finais entram como `.webp` (já é o padrão do projeto) em `public/`, nunca como componente gerado em runtime.

### O que realmente precisa ser produzido
- **Banner de login** (substituição do arquivo com conteúdo errado — item Crítico da auditoria): mensagem de boas-vindas/retorno, mesma composição de câmera/iluminação do banner de signup para parecerem "irmãos".
- **Um novo conjunto de 3 banners do carrossel de `/home`** no mesmo motivo visual do hero (hoje são 3 composições fotorealistas de banco de imagem — PIX/dinheiro/segurança — que não conversam com o hero 3D estilizado).
- **Nada além disso precisa ser produzido do zero.** O hero da landing (`HeroScene`, 3D real via Three.js) já é o padrão-ouro de estilo — ele deve ser a referência, não algo a substituir.

### O que pode ser substituído por assets existentes
- O banner de **signup** já está correto em conteúdo — só precisa, no médio prazo (Fase 3), ser reproduzido no mesmo motivo visual dos novos banners de login/home, mas não é urgente trocar agora.
- O ícone da moeda (`public/coin-icon.webp`) e o asset do WhatsApp já existem e já foram integrados nesta sessão — reaproveitar em qualquer novo elemento que precise do mesmo motivo de moeda em vez de desenhar um novo.

### Como integrar ao Next.js
- Sempre via `next/image` com `sizes` explícito (nunca `<img>` cru) — já é o padrão em `deposit-panel.tsx`/`bet-panel.tsx`? **Verificar caso a caso ao implementar**; onde ainda houver `<img>` puro, migrar para `next/image` no mesmo PR que trocar o asset, para ganhar otimização automática (AVIF/WebP responsivo, lazy loading) sem custo extra de engenharia.
- Banners "hero" (login/signup/home) usam `priority` (LCP da tela) + `sizes="100vw"` em mobile / largura do card em desktop.
- Nenhuma dessas imagens deve ser SVG decorativo pesado — manter `.webp` para fotos/composições, `.svg` só para ícones/linhas.

### Como garantir que continuem responsivos
- Banners são compostos em proporção fixa (ex.: 16:9 no card do carrossel) com `object-fit: cover` e um "safe crop" central — ou seja, ao encomendar a arte, pedir que o elemento principal (texto, mascote) fique no terço central da composição, para sobreviver a corte tanto em 375px quanto em 1280px sem perder o elemento importante.
- Onde o texto for parte da imagem (hoje é o caso da headline da landing — problema D da auditoria), a meta é **eliminar isso**: texto vira HTML/CSS real (`font-display`) sobreposto à arte, nunca embutido no arquivo de imagem. Isso resolve responsividade, acessibilidade (leitores de tela) e o próprio bug de digitação de uma vez.

### Como manter consistência entre Landing, Login, Cadastro, Home, Perfil, Carteira, Depósito e Indicação
Nem toda tela precisa de ilustração — a consistência aqui é **de sistema**, não de "colocar arte em tudo":

| Tela | Papel da arte | O que muda |
|---|---|---|
| Landing | Protagonista (hero 3D) | Já correto — referência de estilo para as outras |
| Login | Banner lateral | Trocar asset (bug), mesmo motivo visual do hero |
| Cadastro | Banner lateral | Manter conteúdo, alinhar estilo ao brief na Fase 3 |
| Home | Carrossel promocional | Recriar os 3 banners no motivo visual único |
| Perfil | **Nenhuma ilustração** | Aqui a consistência vem do Design System (seção 4), não de arte — telas de configuração usam textura/superfície, não banners |
| Carteira (depósito/saque) | **Nenhuma ilustração nova** | Idem — ganho vem de tratamento de card/CTA, não de banner |
| Indicação | Possível ilustração leve no topo (ex.: elemento 3D pequeno reaproveitado do hero) | Baixa prioridade, só depois do redesenho estrutural da tela (Fase 2) |

Ou seja: a consistência não é "toda tela ganha uma ilustração nova" — é "as poucas telas que têm ilustração (Landing/Login/Cadastro/Home) compartilham o mesmo motivo visual, e as telas funcionais (Perfil/Carteira/Indicação) ganham consistência através do Design System de componentes, não de arte".

---

## 2. Motion Design

### Regra geral (para não cair em excesso)
Motion entra em três categorias, cada uma com uma ferramenta certa — misturar ferramentas fora do papel dela é como o excesso de animação acontece:

| Categoria | Ferramenta | Quando usar |
|---|---|---|
| Transições de UI (entra/sai, hover, layout) | **Framer Motion** (já instalado, já em uso) | Qualquer elemento de interface que muda de estado: modais, troca de aba, hover de botão/card, número que incrementa |
| Celebração pontual (evento de sucesso, não contínuo) | **canvas-confetti** (já instalado, já em uso na Vitória) | Só em momentos de conquista real: vitória, depósito confirmado. Nunca em ações rotineiras |
| Ícone/loading com narrativa própria (não é só "girar") | **Lottie** (novo) | Só onde um ícone precisa "contar uma micro-história" (ex.: moeda caindo no cofre ao confirmar saque) — não para spinners genéricos |
| Ambiente contínuo de fundo (partículas persistentes) | **@tsparticles** (novo, avaliar necessidade real) | Só se decidirmos ter um fundo "vivo" na Landing/Home — **não recomendo por padrão**, ver alternativa abaixo |

### Mapeamento tela a tela

**Landing** — Framer Motion para reveal de seções ao scroll (fade+translateY discreto, já é um padrão comum e o `IntersectionObserver` do Framer resolve isso com `whileInView`); nenhum confete, nenhum Lottie, nenhuma partícula persistente (a landing precisa carregar rápido para SEO/ads — motion pesado aqui é a pior escolha em custo/benefício).

**Login/Cadastro** — Framer Motion apenas em transição de estado de formulário (erro de campo, toggle de senha visível). Nada mais — telas de auth devem ser as mais "silenciosas" do produto (o usuário só quer entrar).

**Home** — Framer Motion no carrossel de banners (já existe via `AnimatePresence`? confirmar em `promo-carousel.tsx` na implementação) e no `AnimatedNumber` do valor de meta (já existe). Nenhum confete/Lottie aqui — é uma tela de "painel de controle", não de celebração.

**Vitória (`victory-overlay.tsx`)** — já correto: Framer Motion na entrada do card + confetti já implementado. Único ajuste sugerido: nenhum, este é o padrão a copiar para os outros pontos.

**Derrota (`defeat-overlay.tsx`)** — Framer Motion na entrada do card, **sem confete** (óbvio, mas reforçando: nenhuma celebração em estado de perda) e **sem Lottie** — o silêncio aqui é parte do design, um "shake" sutil de card (Framer, `x: [0, -4, 4, 0]`) é o teto de expressividade aceitável.

**Depósito (`deposit-panel.tsx`)** — ao confirmar PIX com sucesso: reaproveitar o **mesmo padrão de confetti da Vitória**, mas com paleta dourada/verde (não roxo/rosa) para diferenciar "sucesso financeiro" de "sucesso de jogo". Framer Motion já cobre a troca de step (`amount` → `pix`, já implementado com `AnimatePresence`).

**Saque (`withdraw-panel.tsx`)** — sem confete (saque não é um evento "positivo e imediato" da mesma forma — o valor sai da conta e fica pendente de aprovação; celebrar isso seria estranho). Aqui um Lottie pequeno e opcional (ex.: ícone de "enviado"/avião de papel) no toast de confirmação é o único candidato a motion novo, e é dispensável — Framer Motion no toast já é suficiente.

**Cashback** — se/quando existir uma notificação dedicada de cashback recebido, mesmo tratamento do depósito (confetti dourado leve) por ser também "dinheiro entrando".

**Indicação (`/referrals`)** — Framer Motion na animação de progresso (se a Fase 2 introduzir uma "barra de nível de afiliado", ela anima com Framer). Sem confete/Lottie por padrão; considerar um Lottie **só** se for criado um momento específico de "novo indicado cadastrado" como notificação em tempo real — não como decoração permanente da tela.

**HUD do jogo** — nenhuma mudança de motion aqui além do que já existe (o próprio jogo já é motion 3D via R3F) — **Lottie e partículas 2D não devem entrar no HUD**, ele já compete por atenção com a cena 3D.

### Quando usar cada uma (resumo direto)
- **Framer Motion**: sempre que algo muda de estado na interface (aparecer/sumir, hover, drag, número mudando). É a ferramenta padrão, já paga, já dominada pelo time.
- **Lottie**: só quando um ícone precisa de uma micro-narrativa que CSS/Framer não conseguem expressar bem (ex.: moeda caindo, envelope abrindo) — e só em 1-2 pontos do produto, não em todo ícone.
- **Confetti**: só em confirmação de ganho de dinheiro/vitória (Vitória, Depósito, Cashback) — nunca em ações neutras (login, navegação, saque).
- **Partículas persistentes (@tsparticles)**: **evitar por padrão**. Ver alternativa abaixo.

### Quando NÃO usar cada uma
- Não usar Framer Motion em listas longas (histórico de transações) com `stagger` em cada item — isso atrasa a percepção de carregamento em vez de ajudar.
- Não usar Lottie para loading states genéricos — um skeleton (já existe `Skeleton`) é mais rápido de perceber que "algo está carregando" do que uma animação decorativa.
- Não usar confetti em toasts recorrentes (cada aposta, cada transação pequena) — perde o efeito de "momento especial" se disparar toda hora.
- Não usar partículas de fundo em telas com formulário ou dado financeiro (Segurança, Transações, Depósito/Saque) — compete com legibilidade e é o tipo de "flourish" que a própria auditoria pediu para eu caçar.

### Alternativa melhor a `@tsparticles`
Antes de adicionar essa dependência nova, a alternativa melhor é **não adicionar nada**: o projeto já tem `.noise-overlay` (ruído SVG inline, custo ~0) e os glows radiais em `.bg-app-radial` — esse "ambiente vivo" já existe de forma leve. Se a vontade for um fundo mais dinâmico especificamente na Landing, a opção de menor risco é uma **cena Three.js muito simples** (poucas partículas com `@react-three/fiber`, que já é dependência do projeto) rodando só ali, em vez de trazer uma biblioteca 2D nova só para partículas — reaproveita o motor gráfico que já existe e já é otimizado (WebGL) em vez de somar uma segunda tecnologia de partículas (DOM/Canvas 2D) ao lado dele.

---

## 3. Tipografia — Hierarquia Completa

### Estado atual (não muda)
- **Inter** (`--font-sans`) — corpo, labels, formulários, tabelas, navegação. Pesos 400–900 já carregados.
- **Baloo 2** (`--font-display`) — headlines, multiplicador, valores importantes, CTAs de jogo. Pesos 600–800 já carregados.

### Proposta: uma terceira fonte, só para números tabulares financeiros
**Escolha: uma fonte monoespaçada com números tabulares fortes** — recomendo **JetBrains Mono** (Google Fonts, self-hostável via `next/font/google`, mesma forma de integração já usada para Inter/Baloo, licença open, pesos 400/500/700 suficientes).

**Por quê:** o produto já usa Inter para tudo que é texto e Baloo para tudo que é "importante/jogo" — falta uma terceira voz **só para dados financeiros densos** (extratos, histórico de partidas, HUD secundário) onde alinhamento numérico perfeito (dígitos de largura igual) importa mais do que personalidade. Um mono com números tabulares comunica "precisão"/"terminal financeiro" — reforça a sensação de plataforma séria com dinheiro real, sem competir com o Baloo nos momentos de emoção (vitória, CTA).

**Alternativa mais simples (e, sendo honesto, provavelmente suficiente):** não adicionar fonte nenhuma — aplicar `font-variant-numeric: tabular-nums` na própria Inter (zero custo, zero dependência nova, zero risco de carregamento) em qualquer lugar com colunas de números (histórico, extrato). Isso já resolve 80% do ganho (alinhamento) sem o custo de uma terceira família tipográfica. **Recomendo começar por aqui na Fase 1** e só avaliar o JetBrains Mono depois, se o time achar que falta ainda mais distinção visual nos números após ver o resultado do `tabular-nums`.

### Hierarquia tipográfica proposta

| Uso | Fonte | Peso | Tamanho (referência) | Onde |
|---|---|---|---|---|
| Multiplicador em jogo (HUD) | Baloo 2 | 800 | `text-3xl`/`text-5xl` | HUD, Vitória, Derrota |
| Valor ganho/perdido (headline do resultado) | Baloo 2 | 800 | `text-5xl` | Vitória/Derrota overlay |
| Headline de página (hero, título de seção) | Baloo 2 | 700 | `text-4xl`–`text-6xl` | Landing hero, títulos de tela |
| CTA de jogo (Jogar, Cadastrar-se, Entrar) | Baloo 2 | 700 | `text-base` | Botões `gold`/`arcade` |
| Corpo de texto, parágrafos, descrições | Inter | 400–500 | `text-sm`/`text-base` | Toda a app |
| Labels de formulário, legendas | Inter | 500–600 | `text-sm` | Inputs, tabs |
| Navegação (bottom-nav, tabs) | Inter | 500–600 | `text-[11px]`–`text-sm` | Bottom nav, tab scroller |
| Números tabulares (extrato, histórico, HUD secundário) | Inter + `tabular-nums` (ou JetBrains Mono, Fase 2+) | 500–700 | `text-sm`/`text-base` | Transações, Histórico de jogo, stats do Perfil |
| Dados de tabela/admin-like (não é o foco desta auditoria, mas mesma regra) | Inter + `tabular-nums` | 400–500 | `text-sm` | — |

**Regra de ouro que já existe e deve continuar:** Baloo 2 nunca em body/labels/forms/tabelas — é o que já está documentado em `globals.css`, mantido.

---

## 4. Design System

### Tokens (o que já existe → o que falta)

**Cor** — completo, só precisa de disciplina de uso (evitar introduzir cor solta fora dos tokens, problema M da auditoria: introduzir 1 cor de apoio nova, ex. um ciano `--color-accent-cool` para "social/indicação", sem tocar nas demais).

**Espaçamento** — o projeto usa a escala padrão do Tailwind v4 (base 4px, sem override em `globals.css`). **Não recomendo criar uma escala de espaçamento customizada** — a escala padrão do Tailwind já é bem desenhada e mudar isso agora forçaria retrabalho em todo componente existente sem ganho visual proporcional. A melhoria real de espaçamento é **de disciplina de uso** (ritmo consistente entre seções: `gap-6`/`gap-8` como padrão de bloco, não misturar `mb-4`/`mb-5`/`mb-7` arbitrariamente) — isso é um lint de revisão, não um token novo.

**Raio** — hoje só 2 tokens (`--radius-card: 20px`, `--radius-btn: 14px`). Proposta: adicionar `--radius-input: 16px` (hoje inputs usam `rounded-2xl`/`rounded-xl` inconsistentemente entre componentes) e `--radius-pill: 999px` (para badges/chips) — nomeando o que já é praticado, não inventando valores novos.

**Sombra/Glow** — já existem `.glow-purple/pink/green/gold`. Proposta: adicionar `.glow-cool` (para a cor de apoio nova, se adotada) e formalizar 2 níveis de elevação (`--shadow-sm`/`--shadow-lg`) para cards em diferentes contextos (card de lista vs. card hero), hoje resolvido caso a caso com `box-shadow` inline.

### Componentes — o que existe, o que falta

| Componente | Estado | Ação proposta |
|---|---|---|
| `Button` | Completo, 8 variants | Nenhuma mudança de código — só aplicar `gold` nos 2 CTAs pendentes (Resgatar, Retry) |
| `Card` | `surface`/`arcade`, `arcade` não usado | Adicionar variants `hero-number` (número grande + label, substitui o grid de caixinhas repetido) e `list-row` (linha de lista com ícone+texto+valor, para Transações/Histórico) |
| `Input` | Existe, 1 estilo | Adicionar variant visual com glow de foco dourado (hoje é roxo) para contextos financeiros (valor de depósito/saque) |
| `Modal` | Existe | Auditar se usa `glass-card`/blur consistente com o resto — ajuste visual, não estrutural |
| `Badge` | Existe | Definir uso canônico: status (Concluído/Pendente), nunca decoração |
| `Chip` | **Não existe como componente próprio** | Hoje "chips" de filtro (Tudo/Depósitos/Saques em Transações, Tudo/Hoje/Ontem em Histórico) são `<button>` estilizados ad-hoc, repetidos em cada tela — extrair para `src/components/ui/chip.tsx` |
| HUD | Existe (`game-hud.tsx`), já compactado nesta sessão | Fora de escopo desta auditoria (é o jogo, já tratado em outra frente) |
| Sidebar | **Não aplicável** | O player não tem sidebar (é bottom-nav) — item da pergunta original não se aplica a esta zona |
| Bottom Navigation | Existe (`bottom-nav.tsx`), já com CTA gold | Nenhuma mudança pendente |
| Toast | Via `react-hot-toast` (não é componente próprio) | Customizar o tema do `Toaster` (cores/raio/fonte) para bater com os tokens em vez do estilo padrão da lib — ganho barato, ainda não feito |

### Organização em componentes reutilizáveis
Estrutura já existe e deve ser mantida: `src/components/ui/` para primitivos puros (sem lógica de domínio), `src/components/<domínio>/` para composições (`wallet/`, `profile/`, `home/`). Os novos componentes (`Chip`, variantes de `Card`) entram em `src/components/ui/`, seguindo exatamente o padrão já usado por `Button`/`Card` (`cva` para variants, `forwardRef`, `cn()` de `src/lib/utils`).

### Como o MCP do Figma aceleraria o fluxo
O ambiente já tem um conector Figma disponível (ferramentas `mcp__...__get_design_context`, `get_variable_defs`, `get_code_connect_map`, etc.). O uso realista dele **não é** "gerar design do nada" — é acelerar a ponte entre um arquivo Figma (feito por um humano/estúdio de design seguindo este documento) e o código:

1. Um designer monta os componentes em Figma usando os tokens desta seção como Figma Variables (cor/raio/espaçamento espelhando `globals.css` 1:1).
2. `get_variable_defs` extrai essas variáveis do arquivo Figma — permite conferir que o Figma e o `globals.css` não divergiram.
3. `get_design_context`/`get_screenshot` trazem o layout de uma tela específica (ex.: o novo redesenho de "Indique e Ganhe") para eu implementar o JSX/CSS a partir do frame real, em vez de eu inferir o layout só por descrição em texto — reduz retrabalho de "não ficou como no Figma".
4. `get_code_connect_map`/`send_code_connect_mappings` permitem, depois, linkar componente Figma ↔ componente React (`Card`, `Button`) para que qualquer designer veja no próprio Figma qual componente de código aquele frame já usa — útil quando o projeto crescer e mais pessoas mexerem no design.

**Prático:** o Figma MCP só entrega valor se existir um arquivo Figma real por trás — ele não substitui a etapa 1 (alguém desenhando). Seu uso real no fluxo é a partir da Fase 2/3, quando houver um arquivo de design para consultar.

---

## 5. Assets Premium

### Ícones — desenhar, adaptar ou biblioteca?
**Não recomendo desenhar um set completo do zero** (custo alto, prazo longo, risco de inconsistência de peso/grade entre ícones). A abordagem de melhor custo/benefício:

1. **Adaptar uma biblioteca-base com estilo mais "cheio"/amigável que o Lucide** (que é fino, técnico, neutro — correto para um SaaS, mas é exatamente o motivo pelo qual hoje "parece painel administrativo"). Candidatas: **Phosphor Icons** (tem peso `duotone`/`fill`, mais presença visual, licença MIT, `phosphor-react` tem árvore tree-shakeable) ou **Iconoir** (mais geométrico/arredondado). Recomendo **Phosphor no peso `duotone`**, colorindo o traço secundário com o dourado — isso já cria uma diferenciação de marca em ícones genéricos (ex.: "seta de saque") sem custo de design.
2. **Comissionar só o punhado de ícones que não têm equivalente genérico bom** — a lista pedida (moeda, PIX, saque, depósito, bônus, afiliados, torneios, presentes, recompensas) tem no máximo 3-4 itens sem bom equivalente pronto (torneios, presentes/recompensas com a "cara" do produto); o resto (moeda, PIX, saque, depósito, afiliados) o Phosphor já cobre bem.

### Como eu faria os ícones específicos pedidos
- **Moeda**: já existe (`public/coin-icon.webp`) — reaproveitar como ícone raster nos poucos lugares que precisam da moeda "de marca" (ex.: saldo no topbar), Phosphor `coin`/`coins` (vetor) para usos inline pequenos onde raster perderia nitidez.
- **PIX**: usar o ícone oficial do PIX (identidade visual pública do Banco Central, já usado corretamente no botão "Gerar QR Code PIX") — não reinventar, é reconhecimento de marca externo que ajuda confiança.
- **Saque/Depósito**: Phosphor `arrow-circle-up`/`arrow-circle-down` ou os já usados (`ArrowUpRight`/`Plus` do Lucide) — troca é só de biblioteca, ícone semântico já está correto.
- **Bônus**: um ícone custom simples (estrela/badge com o motivo da moeda) — candidato a comissionar, 1 ícone.
- **Afiliados/Indicação**: Phosphor `share-network` ou `users-three` cobre bem, sem necessidade de custom.
- **Torneios**: sem bom equivalente genérico (a maioria das libs trata como "troféu" genérico) — se o produto não tem torneios hoje (não encontrei essa feature no código), **não produzir esse ícone agora** — seria trabalho para uma feature que não existe.
- **Presentes/Recompensas**: Phosphor `gift`/`trophy` já cobrem semanticamente; customizar só se/quando existir uma feature de recompensas dedicada.

### Integração técnica
Ícones vetoriais (Phosphor + os 2-3 custom) entram como componentes React em `src/components/icons/` (mesmo padrão de qualquer ícone Lucide hoje: `<Icon className="size-5" />`, `currentColor`), SVG otimizado (sem `<title>`/metadata de editor), tree-shakeable por import nomeado — nenhuma mudança de arquitetura, só substituição de biblioteca de ícone ponto a ponto.

### Texturas premium sem custo de performance
O projeto **já resolveu isso** com `.noise-overlay` em `globals.css`: um SVG de ruído (`feTurbulence`) embutido como `data:` URI, aplicado como `background-image` de um `<div>` `fixed`/`opacity: 0.035` — zero requisição HTTP, zero imagem rasterizada, custo de renderização desprezível (é só um filtro SVG estático, não recalculado por frame).

**Proposta:** replicar exatamente essa técnica em escala de componente — uma classe `.texture-subtle` com o mesmo `data:` URI, `opacity` um pouco mais alta (`0.05`–`0.08`), aplicada via `::before` posicionado dentro de cards específicos (ex.: o novo `Card` variant `hero-number`) para dar uma sensação de "material" sem qualquer imagem nova, sem WebGL, sem custo de rede — literalmente reaproveitando o asset (inline, não um arquivo) que já está em produção. **Risco de performance: nenhum**, é a mesma técnica já validada no site inteiro hoje.

---

## 6. Roadmap de Implementação

| Fase | Conteúdo | Tempo estimado | Impacto visual | Risco | Arquivos principais afetados |
|---|---|---|---|---|---|
| **Fase 1 — Correções críticas** | Trocar asset do banner de login; headline da landing de imagem→texto real; botões do header público → variant `gold`; `Resgatar`/retry → `gold`; `tabular-nums` em números financeiros | 1–3 dias | Alto (resolve os 2 itens Críticos + inconsistência mais visível) | Baixo — mudanças isoladas, sem novo componente | `public/auth-banner-login.webp`, `src/components/landing/hero-section.tsx` (ou equivalente), header da landing, `game-hud.tsx`, `defeat-overlay.tsx`/erro de rede, `globals.css` |
| **Fase 2 — Sistema de componentes** | `Card` variants `hero-number`/`list-row`; componente `Chip` extraído; tema do `Toaster`; tokens de raio/glow novos; redesenho estrutural de Indique e Ganhe e das abas do Perfil usando os novos variants | 1–2 semanas | Alto (elimina a repetição de "grid de caixinhas", o achado mais citado da auditoria) | Médio — toca em várias telas ao mesmo tempo, precisa de QA visual tela a tela | `src/components/ui/card.tsx`, novo `src/components/ui/chip.tsx`, `referrals` screen, `profile-screen.tsx` e sub-componentes de aba, `providers.tsx` (tema do Toaster) |
| **Fase 3 — Identidade e motion** | Novo banner de login (arte) + novo carrossel do Home (arte); confetti dourado no depósito; Framer Motion no scroll da landing; segunda cor de apoio (`--color-accent-cool`) | 2–4 semanas (depende de produção de arte externa) | Alto (resolve a fragmentação de estilo, o achado mais "estrutural" da auditoria) | Médio — depende de terceiros (arte), risco de prazo, não de código | `public/*.webp` novos, `deposit-panel.tsx`, `globals.css`, landing sections |
| **Fase 4 — Redesenho de telas funcionais** | Layout full-bleed da landing; formulário de signup restilizado; rodapé expandido; ícones Phosphor substituindo Lucide nos pontos financeiros | 2–3 semanas | Médio-Alto (polimento amplo, menos "big bang" que Fase 3) | Médio — troca de biblioteca de ícone precisa de varredura completa para não deixar mistura visual | `signup/page.tsx`, footer da landing, landing sections, imports de ícone em toda a app |
| **Fase 5 — Polimento contínuo** | Lottie em 1-2 pontos (saque confirmado); textura `.texture-subtle` nos novos cards; microanimações de foco em inputs; revisão final de consistência | Contínuo, sem prazo fechado | Médio (refinamento, não estrutural) | Baixo | `input.tsx`, cards financeiros, novo `lottie-react` se adotado |

**Dependências novas por fase:** nenhuma na Fase 1 e 2. Fase 3 não adiciona dependência (reaproveita `canvas-confetti`/`framer-motion` já instalados). Fase 4 adiciona `phosphor-react` (ícones). Fase 5 adiciona `lottie-react` **apenas se** os 1-2 pontos de uso forem aprovados — não é uma dependência "garantida", é opcional e pontual.

---

## 7. Moodboard — Padrões a Observar (não a copiar)

| Referência | O que observar (padrão, não layout) | Como aplicaria no HeliJump |
|---|---|---|
| **Stake** | Hierarquia agressiva: o saldo e o botão de ação principal sempre dominam visualmente a tela, todo o resto é deliberadamente menor | Aplicar na Fase 2: menos "grids de caixinhas do mesmo tamanho", mais 1 número hero + resto secundário |
| **BC.Game** | Uso de ilustração/mascote consistente em pontos de gamificação (missões, recompensas) sem invadir telas financeiras "sérias" | Confirma a decisão da seção 1: ilustração só onde há "convite ao jogo", não em Segurança/Transações |
| **Rollbit** | Motion contido e funcional — números que incrementam suavemente, sem excesso de partículas soltas | Reforça a regra da seção 2: Framer Motion para estado, confetti só em vitória/depósito |
| **Duelbits** | Paleta com 1 acento quente dominante + neutros escuros, sem poluição de cor secundária | Confirma manter o roxo como base e introduzir só 1 cor de apoio (seção 4), não várias |
| **CSGORoll** | Cards de item/recompensa com "moldura" temática (bevel, borda de raridade) em vez de card genérico | Referência direta para o `Card` variant `hero-number` da Fase 2 — moldura com peso, não só borda fina |
| **Blaze** | Navegação simples e previsível (bottom-nav enxuto, sem menu escondido) | Já é o padrão atual do HeliJump (bottom-nav de 5 itens) — nenhuma mudança necessária, só validação de que já está no caminho certo |
| **Apple** | Tipografia como hierarquia primária — quase nenhuma "caixa", o espaçamento e o peso da fonte já comunicam importância | Referência para reduzir a dependência de `border`/`bg` em cada bloco de conteúdo (o oposto do padrão "tudo em card" atual) |
| **Stripe** | Dados financeiros densos apresentados com clareza tipográfica (tabular, alinhado), sem excesso decorativo | Referência direta para a seção 3 (tabular-nums) e para Transações/Histórico — dado denso não precisa de mais cor, precisa de mais alinhamento |
| **Linear** | Consistência absoluta de componente — o mesmo padrão de card/botão em toda a superfície do produto, sem variação não intencional | É o objetivo macro de todo este documento: um único Design System (seção 4), zero variação acidental entre telas |

**Explicitamente não fazer:** copiar a estrutura de layout de nenhum desses produtos ponto a ponto (grid exato, posição exata de elementos) — o que se importa é o *princípio* (hierarquia, contenção de motion, tipografia como estrutura), a composição final do HeliJump continua sendo desenhada em cima da identidade "arcade dourado sobre roxo profundo" já estabelecida.

---

## 8. Guia Definitivo de Direção de Arte (resumo executivo)

Esta seção é o que qualquer alteração futura deve respeitar, mesmo sem reler o documento inteiro:

1. **Paleta:** roxo profundo (`--color-primary`) é a base estrutural/navegação; dourado (`--color-gold*`) é reservado para CTA/conversão/dinheiro-ganho; verde (`--color-positive`) só para sucesso/saldo positivo; vermelho (`--color-danger`) só para perda/erro. Nenhuma cor nova entra sem passar a ser um token em `globals.css` primeiro.
2. **Tipografia:** Baloo 2 é para emoção (headline, multiplicador, CTA de jogo); Inter é para função (tudo mais); números financeiros densos ganham `tabular-nums`. Nunca Baloo em formulário/tabela.
3. **Ilustração:** só existe em Landing/Login/Cadastro/Home — sempre no mesmo motivo visual 3D estilizado do hero atual. Telas funcionais (Perfil/Carteira/Indicação) nunca ganham banner — ganham consistência via componente, não via arte.
4. **Motion:** Framer Motion é o padrão para qualquer mudança de estado de UI. Confetti só em vitória/depósito confirmado. Lottie é exceção rara, não regra. Nada de partículas de fundo permanentes fora do motor 3D já existente.
5. **Componentes:** um único `Card`, um único `Button`, com variants — nunca um card/botão "avulso" estilizado inline para uma tela específica. Se uma tela precisa de um visual novo, o variant nasce no componente compartilhado, não como CSS solto naquela tela.
6. **Hierarquia:** no máximo 1-2 "números hero" por tela — o resto é secundário, deliberadamente menor. Se tudo é grande, nada é importante (o problema central identificado na auditoria).
7. **Ícones:** consistência de biblioteca (Fase 4 migra para Phosphor duotone) — nunca misturar duas bibliotecas de ícone na mesma tela.
8. **Textura:** superfícies podem ter ruído sutil (`.noise-overlay`/`.texture-subtle`), nunca imagem de textura pesada — a técnica já validada em produção é a referência.

---

*Documento vivo — atualizar esta seção 8 sempre que uma decisão de direção de arte for revisada, para que continue sendo a referência de consulta rápida.*
