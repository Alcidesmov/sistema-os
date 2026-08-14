# CLAUDE.md — MecOS (Sistema de OS para Oficinas Mecânicas)

> Este arquivo é lido automaticamente pelo Claude Code no início de cada
> sessão neste projeto. É a fonte de verdade sobre visão, arquitetura,
> módulos e decisões — **deve ser atualizado a cada mudança relevante**,
> junto com o commit que a introduz. Ver seção "Histórico de Versões" no
> final.

> ## ⚠️ Fluxo de trabalho: commit só depois de homologação local
>
> **Não commitar nem dar push assim que uma mudança de código termina.**
> O fluxo combinado com o Alcides é:
>
> 1. Fazer a mudança e deixar rodando local (`localhost:3000`, servidor já
>    ativo via `.claude/launch.json` / `npm run dev`).
> 2. Avisar que está pronto e esperar ele navegar/testar — ele chama isso
>    de **"homologação"**.
> 3. Só depois que ele aprovar: `git add` + `git commit` + `git push`
>    (push segue a seção 6.6 — sempre pedindo pra ele rodar no terminal
>    dele).
>
> **Por quê:** durante a homologação pode surgir ajuste/melhoria na
> mudança recém-feita. Commitar antes disso significa corrigir em cima de
> algo que ainda nem foi validado rodando.
>
> **Exceção:** se ele pedir explicitamente pra commitar/subir ("pode
> commitar", "sobe", etc.), seguir a instrução dele — mas isso vale só
> para aquela mudança específica, não é autorização permanente pra pular
> a homologação depois. Ver seção 6.8 para detalhe.

> ## 🏢 Conta/oficina canônica em uso: RRadiadores
>
> Login: `teste@mecos.com` / `senha123456` — apesar do e-mail dizer
> "teste", **essa é a conta real que o Alcides usa hoje** (decisão dele em
> 2026-08-13, ver seção 3). Nasceu como conta de teste durante o
> desenvolvimento e virou a conta de produção informal — o e-mail não foi
> trocado, só o nome da oficina (`clients/{uid}.name = "RRadiadores"`).
>
> **Não criar outra conta/oficina "de teste" nova sem necessidade** — isso
> foi exatamente o que causou a confusão do Alcides não achar o catálogo
> de serviços (ver seção 6.9). Qualquer dado novo relevante (catálogo,
> clientes, OS) deve ir para esta conta, a menos que ele peça outra coisa
> explicitamente.
>
> **Achado (2026-08-13, ao publicar a regra nova):** existe um segundo
> documento `clients/{clientId}` órfão no Firestore, com `name:
> "35alcides"` — indício de que o próprio Alcides criou uma conta com o
> e-mail real dele (`35alcides@gmail.com`, o mesmo logado no console do
> Firebase) em algum momento, provavelmente na tentativa de navegar o
> sistema antes desta conversa — exatamente o cenário da seção 6.9.
> **Não apaguei nem investiguei mais fundo** — não tinha certeza se tem
> dado que ele queira, e apagar conta/tenant é irreversível. Perguntar
> pra ele antes de mexer.

> ## ✅ `firebase/firestore.rules` novo publicado (2026-08-13)
>
> A regra multi-usuário (seção 3.1) foi publicada no console do Firebase
> do projeto `sistema-os-ef1ef` — via Claude in Chrome, com autorização
> explícita do Alcides, já que é uma mudança em infraestrutura live (não
> só um arquivo local). **Testado ponta a ponta e confirmado**: criei um
> usuário real (Maria Recepção, papel Recepcionista,
> `recepcao@rradiadores.com`) pela própria tela "Usuários", desloguei do
> gestor, loguei como ela, e confirmei que ela vê os mesmos dados da
> RRadiadores (2 OS, mesmo faturamento) e **não** vê "Oficina"/"Usuários"
> no menu (gate de papel funcionando). Esse usuário de teste ficou
> cadastrado — sem tela de exclusão de usuário ainda, o Alcides pode
> ignorar ou pedir pra remover.

**Versão atual: v0.4.2** — Fase 1 (setup) e Fase 2 (CRUD de OS + workflow)
completas. Ambiente de emissão de NF pronto em modo de teste (Fase 3 em
andamento, provedor real ainda não conectado). Catálogo completo de
serviços/peças (~165 itens) importado do sistema legado. Workflow de OS
migrado para o modelo de 3 estágios (Diagnóstico → Em Serviço →
Finalizado) do sistema de referência, com suporte a item avulso
(preço sem serviço/peça do catálogo) no Diagnóstico. Launcher
`INICIAR_MECOS.command` pra rodar o sistema com duplo clique. A conta de
teste virou a conta real da oficina "RRadiadores" (ver callout acima).
Multi-tenant desacoplado de uid único: oficina agora tem cadastro próprio
(CNPJ/razão social/nome fantasia/endereço) e suporta múltiplos usuários
com papel (gestor/supervisor/mecânico/recepcionista) — ver seção 3.1 e
o callout de pendência acima. Seletor de serviços/peças na Nova OS trocado
de "mostrar tudo" pra busca com autocomplete.

**Documentação complementar** (este arquivo é o resumo geral; para
detalhe, ver):
- [`docs/MODULOS.md`](docs/MODULOS.md) — cada tela, campo por campo, regra por regra
- [`docs/GUIA-VISUAL.md`](docs/GUIA-VISUAL.md) — padrão visual (cores, componentes)
- [`docs/TESTES.md`](docs/TESTES.md) — o que já foi verificado manualmente
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — fases detalhadas com critério de "pronto"
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) · [`docs/FIREBASE-SETUP.md`](docs/FIREBASE-SETUP.md) · [`docs/ENOTA-API.md`](docs/ENOTA-API.md)

---

## 1. Visão Geral

**MecOS** é um sistema de gestão de Ordens de Serviço (OS) para oficinas
mecânicas, multi-tenant (atende várias oficinas-cliente na mesma
infraestrutura). Fluxo de negócio central:

```
Cadastro (cliente + veículo) → Orçamento (itens de serviço/peça) →
Aprovação → Execução (com prazo) → Conclusão → Emissão de NF (em lote)
```

Requisitos originais do produto (pedido do dono, Alcides):

1. Sistema de OS com menos cliques que os concorrentes analisados em vídeo
   — cadastro de cliente/veículo/serviço numa única tela de criação de OS.
2. Orçamento → aprovação → execução com prazo → fechamento → NF opcional.
3. Relatórios de totais de OS por valor, data e tipo de veículo.
4. Geração de XMLs para a contabilidade (NF de comércio) e arquivos de NF
   de serviço — **ainda não implementado**, depende da integração real de
   NF (ver seção 8).
5. Sistema de sugestões de melhoria direto na tela, salvo em formato
   estruturado (JSON) para análise posterior — **implementado** (módulo
   "Melhorias").

---

## 2. Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Mobile | React Native + Expo (estrutura criada, telas não implementadas ainda) |
| Backend | Firebase (Firestore + Authentication) |
| Cloud Functions | Firebase Functions v4 (só placeholder `helloWorld` até agora — nada de produção usa Functions ainda; toda lógica hoje roda client-side direto no Firestore) |
| Hospedagem alvo | Hostinger (frontend) — **ainda não implantado**, hoje só roda em `localhost:3000` via `npm run dev` |
| Banco de dados | Cloud Firestore, região `southamerica-east1` (São Paulo) |
| Repositório | [github.com/Alcidesmov/sistema-os](https://github.com/Alcidesmov/sistema-os) |
| Projeto Firebase | `sistema-os-ef1ef` |

Não há testes automatizados no projeto ainda (nenhum framework de teste
configurado).

---

## 3. Arquitetura Multi-Tenant

Cada oficina-cliente é um **tenant** isolado no Firestore, identificado
por `clientId`. Até a v0.3.x, `clientId` era sempre igual ao `uid` do
usuário dono — ou seja, uma oficina só podia ter um único login. A partir
da v0.4.0 isso mudou (seção 3.1): `clientId` continua sendo o dado que
particiona tudo no Firestore, mas **múltiplos `uid` (múltiplos logins)
podem apontar pro mesmo `clientId`**.

**Isolamento entre oficinas continua absoluto:** cada `clientId` só
enxerga os próprios dados — não existe catálogo/cliente/OS compartilhado
entre oficinas diferentes. Isso já gerou confusão real uma vez (ver seção
6.9: o catálogo de 165 itens ficou preso numa conta que o Alcides não
tinha credenciais) — não confundir isolamento *entre oficinas* (que
continua existindo e é correto) com o problema *daquela vez* (que era
sobre não conseguir logar na oficina certa, resolvido reaproveitando a
conta).

### 3.1 Multi-usuário por oficina (desde v0.4.0)

Pedido do Alcides: a oficina precisa ter cadastro próprio (CNPJ, razão
social, nome fantasia, endereço — seção 4) e suportar vários logins com
papéis diferentes — **gestor, supervisor, mecânico, recepcionista**
(`UserRole` em `lib/types/index.ts`). Antes disso, cada login criava
automaticamente sua PRÓPRIA oficina nova (`clientId = uid`), então não
havia como duas pessoas trabalharem nos mesmos dados.

**Como funciona agora:**

- `users/{uid}` continua existindo, mas virou só um **documento de lookup
  enxuto**: `{ clientId, email, role, createdAt }`. Serve pra resolver
  "esse uid pertence a qual oficina" — usado no bootstrap
  (`useClientId.tsx`) e na regra de segurança (`isMember()` abaixo). Regra
  de escrita não mudou: só o próprio uid escreve o próprio doc.
- `clients/{clientId}/members/{uid}` é uma **subcoleção nova**, espelhando
  o mesmo dado (`name`, `email`, `role`, `createdAt`) mas vivendo dentro
  do tenant — é o que a tela "Usuários" lista, porque assim ela usa a
  MESMA regra de segurança que já vale pra customers/vehicles/services
  (ao contrário de listar direto de `users/{uid}`, que é uma coleção
  top-level e exigiria uma regra de `list` própria e mais arriscada).
- **Primeiro login de uma oficina nova** (bootstrap, `useClientId.tsx`):
  se não existe `users/{uid}`, o sistema cria a oficina com
  `clientId = uid` (igual antes) e o usuário vira `role: 'gestor'`,
  gravando tanto `users/{uid}` quanto `clients/{uid}/members/{uid}`.
- **Adicionar um funcionário a uma oficina existente**: só o gestor, pela
  tela "Usuários" (`app/(app)/usuarios/page.tsx`). Não existe fluxo de
  convite/link — o gestor digita nome, e-mail, senha temporária e papel,
  e o sistema cria o login na hora e repassa a senha pra ele avisar o
  funcionário. **Sem tela de "trocar senha" ainda** — gap conhecido.
- **Truque técnico** (`lib/firebase/members.ts`, função `createMember`):
  o SDK client do Firebase, ao criar um usuário
  (`createUserWithEmailAndPassword`), automaticamente **loga como esse
  usuário novo** — o que derrubaria a sessão do gestor no meio da
  criação. Sem Admin SDK/Cloud Functions configurado neste projeto (só
  placeholder, ver seção 2), a saída é inicializar uma **segunda
  instância do Firebase App** (`initializeApp(firebaseConfig, 'invite-' +
  Date.now())`), criar o usuário nela (sessão isolada, não afeta a app
  principal), escrever `users/{uid}` e `clients/{clientId}/members/{uid}`
  autenticado como o próprio usuário recém-criado (satisfaz as regras sem
  precisar relaxar nada), depois deslogar e descartar essa segunda
  instância. Padrão conhecido do Firebase client SDK pra esse cenário
  exato — não é gambiarra local, é a forma documentada de "admin cria
  usuário" sem backend próprio.
- **Controle de acesso por papel é só na UI, não na regra de segurança**:
  as telas "Oficina" e "Usuários" só aparecem no menu e só renderizam
  conteúdo pro `role === 'gestor'` (`DashboardShell.tsx`,
  `app/(app)/oficina/page.tsx`, `app/(app)/usuarios/page.tsx`) — mas a
  regra do Firestore (`isMember()`) só verifica se o uid pertence àquele
  `clientId`, não o papel dele. Ou seja, tecnicamente um supervisor
  chamando o SDK direto conseguiria escrever em `clients/{clientId}`
  (dados da oficina). Aceitável pro MVP (times pequenos, confiança
  implícita) — se isso importar de verdade, precisa de regra por papel
  (mais `get()` na regra, checando `role` em vez de só `clientId`).
- **"Recepcionista pode dar entrada nos serviços"** (pedido original):
  já funciona hoje sem nenhum código extra — qualquer papel além de
  gestor tem acesso igual a Clientes/Veículos/Serviços/OS (só Oficina e
  Usuários são exclusivos do gestor). Não existe ainda granularidade
  fina entre supervisor/mecânico/recepcionista além disso — é uma
  decisão consciente de escopo pra v1, ajustável depois.

### Estrutura Firestore

```
users/{uid}                              → { clientId, email, role, createdAt } — lookup uid → oficina
clients/{clientId}                       → { name, razaoSocial?, nomeFantasia?, cnpj?, address?, email?, phone?, ownerUid, createdAt }
clients/{clientId}/members/{uid}         → { name, email, role, createdAt } — usado pela tela "Usuários"
clients/{clientId}/customers/{id}        → clientes da oficina (donos dos veículos)
clients/{clientId}/vehicles/{id}         → veículos cadastrados
clients/{clientId}/services/{id}         → catálogo de serviços/peças com preço
clients/{clientId}/orders/{id}           → Ordens de Serviço
clients/{clientId}/invoices/{id}         → Notas Fiscais emitidas (hoje, documentos de teste)
clients/{clientId}/feedback/{id}         → sugestões de melhoria enviadas na UI
```

### Segurança (`firebase/firestore.rules`)

Desde a v0.4.0, a regra usa uma função `isMember(clientId)`: autentica se
`users/{request.auth.uid}` existe **e** seu campo `clientId` bate com o
`clientId` sendo acessado (um `get()` de lookup dentro da regra — padrão
comum do Firestore pra multi-tenant multi-usuário). Isso substitui a
regra antiga (`request.auth.uid == clientId`), que só funcionava pro
dono original. `users/{uid}` continua com regra própria e mais simples
(só o dono do uid lê/escreve o próprio doc).

**⚠️ Isso está só no arquivo local — ver o callout "🚧 Pendência crítica"
no topo deste arquivo e o passo a passo na seção 6.10.** Não há
`firebase-tools`/Admin SDK configurado neste projeto — toda publicação de
regra é manual via console do Firebase (mesma limitação já documentada
na seção 6.6 pro git push).

---

## 4. Modelo de Dados (TypeScript)

Fonte de verdade: `frontend-web/lib/types/index.ts`.

- **`Customer`** — cliente da oficina: `name`, `phone`, `email?`, `document?`.
- **`Vehicle`** — `plate`, `brand`, `model`, `year`, `color`, `type`
  (`carro | moto | caminhao | outro`), `customerId`.
- **`ServiceItem`** — item de catálogo: `name`, `price`, `type`
  (`service | part`). Usado para montar orçamentos rapidamente.
- **`Order`** — a Ordem de Serviço. Campos-chave:
  - `status: OrderStatus` = `diagnostico | em_servico | finalizado | invoiced`
    (modelo de 3 estágios + faturamento, ver seção 6.5)
  - `items: OrderLineItem[]` — linhas do orçamento (serviço/peça, qtd,
    preço unitário, subtotal). Pode incluir itens "avulsos" (sem
    `itemId` de um `ServiceItem` real — só um id gerado no cliente),
    usados no Diagnóstico quando o preço já é conhecido mas o
    serviço/peça exato ainda não foi definido.
  - `totalValue`, `quoteApprovedAt?`, `executionStartedAt?`,
    `executionEstimatedEnd?`, `executionCompletedAt?`
  - `invoiceRequested?: boolean` — dono da oficina "flegou" pra emitir NF
  - `invoiceId?: string` — preenchido quando a NF é de fato emitida
- **`Invoice`** — nota fiscal (hoje, sempre gerada pelo `mockProvider`):
  `orderId`, `provider`, `kind` (`nfe | nfse`), `number`, `totalValue`,
  `documentContent` (HTML do documento), `documentUrl?`, `issuedAt`.
- **`Client`** — a oficina: `name` (bootstrap automático, prefixo do
  e-mail), mais `razaoSocial?`, `nomeFantasia?`, `cnpj?`, `address?`,
  `email?`, `phone?` — desde v0.4.0 editáveis pelo gestor na tela
  "Oficina" (`updateClient`, seção 5.10). `name` continua existindo por
  compatibilidade com telas antigas, mas o cadastro novo usa
  `nomeFantasia`.
- **`UserRole`** — `'gestor' | 'supervisor' | 'mecanico' | 'recepcionista'`
  (v0.4.0). `USER_ROLE_LABEL` tem os rótulos em português pra UI.
- **`UserLookup`** (`users/{uid}`) — `{ clientId, email, role, createdAt }`,
  documento enxuto só pra resolver uid → oficina (ver seção 3.1).
- **`Member`** (`clients/{clientId}/members/{uid}`) — `{ name, email,
  role, createdAt }`, espelha `UserLookup` mas vive dentro do tenant pra
  poder ser listado na tela "Usuários".

---

## 5. Módulos (telas da área logada — `app/(app)/`)

Todas as telas abaixo estão atrás de `app/(app)/layout.tsx`, que redireciona
pra `/login` se não autenticado e resolve o `clientId` via
`ClientProvider` antes de renderizar qualquer página filha.

### 5.1 Autenticação (`app/login/page.tsx`)
Login e cadastro (toggle na mesma tela) por e-mail/senha via Firebase Auth.
Cadastro cria a conta E já bootstrapa a oficina (não existe fluxo de
"criar oficina" separado do "criar usuário").

### 5.2 Dashboard (`app/(app)/dashboard/page.tsx`)
Visão geral: contagem de OS criadas hoje, OS aguardando aprovação, OS em
execução, faturamento do mês corrente, e lista das 8 OS mais recentes com
link direto pro detalhe.

### 5.3 Clientes (`app/(app)/customers/page.tsx`)
CRUD simples (criar + listar) de clientes da oficina — nome, telefone,
e-mail opcional.

### 5.4 Veículos (`app/(app)/vehicles/page.tsx`)
CRUD simples de veículos, vinculados a um cliente existente. Campos: placa,
marca, modelo, ano, cor, tipo.

### 5.5 Serviços e Peças (`app/(app)/services/page.tsx`)
Catálogo de itens que podem entrar num orçamento — nome, tipo
(serviço/peça), preço. É a partir daqui que a tela de "Nova OS" sugere
itens clicáveis.

### 5.6 Ordens de Serviço (`app/(app)/orders/page.tsx` + `orders/[id]/page.tsx`)
**Módulo central do sistema.**

- **Criação rápida** (`orders/page.tsx`, componente `NewOrderForm`): numa
  única tela — seleciona cliente existente OU digita nome+telefone de um
  novo; seleciona veículo existente (filtrado pelo cliente) OU digita
  placa+modelo de um novo; **busca serviços/peças por autocomplete**
  (campo de texto, filtra por nome/código/cód. barras normalizado sem
  acento, até 8 resultados num dropdown, navegável com ↑↓/Enter — desde
  v0.4.0; antes disso a tela listava os ~165 itens do catálogo inteiro
  como "chips" de uma vez, o que ficava ilegível — ver seção 6.11), ou
  lança um **item avulso** (descrição + tipo + preço livre, sem vincular
  ao catálogo — pra quando ainda não se sabe o serviço/peça exato, só o
  preço estimado); total calculado em tempo real. Ao submeter, cria
  cliente/veículo novos se necessário e a OS já nasce com
  `status: 'diagnostico'`.
- **Detalhe e workflow** (`orders/[id]/page.tsx`): botões de ação mudam
  conforme o `status` atual:
  - `diagnostico` → campo de prazo opcional + botão "Aprovar orçamento e
    abrir O.S." → `em_servico` (aprovação já inicia a execução, num só
    passo)
  - `em_servico` → botão "Concluir serviço" → `finalizado`
  - `finalizado` (sem `invoiceRequested`) → botão "Marcar para emissão de
    NF" → seta `invoiceRequested: true` (não muda o `status` ainda)
  - Depois de flegado, a OS entra na fila do módulo de Notas Fiscais (5.7)
- **`app/(app)/orders/page.tsx` também é a tela de listagem** — tabela com
  status colorido, cliente, veículo, total, data.

### 5.7 Notas Fiscais (`app/(app)/invoices/page.tsx`)
Fila de OS `finalizado` + `invoiceRequested: true` que ainda não têm
`invoiceId`. Seleção múltipla + botão "Emitir selecionadas", que chama
`emitInvoiceForOrder` para cada uma. Lista separada de NFs já emitidas,
com botão "Ver documento" (baixa um HTML representando a nota). Banner
fixo no topo avisando que é **modo de teste** — ver seção 8.

### 5.8 Relatórios (`app/(app)/reports/page.tsx`)
Filtro por período (data de/até), totais de OS e valor no período, tabela
agrupada por tipo de veículo (quantidade + valor total), exportação CSV de
todas as OS filtradas.

### 5.9 Melhorias (`app/(app)/feedback/page.tsx` + `components/layout/FeedbackButton.tsx`)
Botão flutuante "💡 Sugerir melhoria" presente em **todas as telas**
(renderizado uma vez no `DashboardShell`). Abre modal com textarea; ao
enviar, grava em `clients/{clientId}/feedback` com a página de origem e o
e-mail do usuário. A tela `/feedback` lista tudo, permite mudar status
(`new/reviewing/done/rejected`) clicando em pills, e tem botão "Exportar
JSON" que baixa todas as sugestões pra análise externa.

### 5.10 Oficina (`app/(app)/oficina/page.tsx`) — desde v0.4.0
Cadastro da oficina: nome fantasia, razão social, CNPJ, telefone,
endereço, e-mail de contato. Pré-carrega de `clients/{clientId}`
(`watchClient`) e salva com `updateClient`. **Só visível/editável pelo
gestor** — outros papéis veem uma mensagem de acesso restrito (gate só
na UI, não na regra do Firestore — ver seção 3.1).

### 5.11 Usuários (`app/(app)/usuarios/page.tsx`) — desde v0.4.0
Lista os membros da oficina (`clients/{clientId}/members`, via
`watchMembers`) e formulário pra criar um novo: nome, e-mail, senha
temporária (gerada automaticamente, editável), papel. Ao criar, mostra
um aviso com as credenciais pra repassar ao funcionário — não existe
envio de e-mail nem tela de "trocar senha" ainda. **Só visível/editável
pelo gestor.** Ver seção 3.1 pro mecanismo técnico de criação (segunda
instância do Firebase App).

---

## 6. Padrões e Decisões Importantes (ler antes de mexer no código)

Estas são convenções e armadilhas descobertas durante o desenvolvimento —
seguir para não reintroduzir bugs já corrigidos.

### 6.1 `updateDoc` do Firestore rejeita `undefined`
Nunca passar um campo com valor `undefined` para `updateDoc`/`addDoc` — o
SDK lança `FirebaseError: invalid-argument`. Se um campo é opcional e pode
não ter valor, **omita a chave inteira** do objeto em vez de setar
`undefined` (ver `updateOrderStatus` em `lib/firebase/firestore.ts` e como
`orders/[id]/page.tsx` monta o objeto `extra` condicionalmente antes de
chamar `updateOrderStatus`).

### 6.2 Tabelas precisam de `overflow-x-auto`
Todo `<table>` em página de listagem deve estar dentro de um
`<div className="overflow-x-auto">` — sem isso, a tabela estoura a largura
da viewport em telas estreitas sem dar scroll (bug real encontrado e
corrigido em todas as páginas de listagem: orders, customers, vehicles,
services, reports, invoices).

### 6.3 Emissão de NF é **desacoplada de provedor** — não hardcode eNotas
Toda a lógica de emissão passa pela interface `InvoiceProvider`
(`lib/invoices/provider.ts`). Hoje `activeInvoiceProvider` aponta pro
`mockInvoiceProvider` (`lib/invoices/mockProvider.ts`), que gera um HTML
de teste sem valor fiscal. **Quando a integração real for decidida (eNotas
"Nota Gateway" ou outro), a troca deve ser feita só no export de
`provider.ts`** — nenhum outro arquivo (páginas, `firestore.ts`) deve
saber qual provedor está ativo. Não emitir NF real sem confirmação
explícita do Alcides — ele pediu para o sistema subir **sem** emissão real
até a integração ser definida.

### 6.4 eNotas mudou de nome para "Nota Gateway"
O domínio antigo `developer.enotasgw.com.br` está **fora do ar**. A
referência de API real e atual é `docs.notagateway.com.br` — ver
`docs/ENOTA-API.md` para tudo que já foi confirmado por leitura direta da
doc (autenticação, cadastro de empresa, vínculo de certificado, endpoint
de emissão) vs. o que ainda precisa ser validado com o suporte.
**Multi-tenant já está confirmado como suportado**: uma única API Key da
conta MecOS cadastra e gerencia N empresas (uma por oficina-cliente),
cada uma com certificado digital próprio vinculado individualmente.

### 6.5 `OrderStatus`: modelo de 3 estágios (Diagnóstico → Em Serviço → Finalizado)
Desde a v0.3.0, `OrderStatus` é `diagnostico | em_servico | finalizado |
invoiced` — substituiu o modelo anterior (`draft | quoted | approved |
in_progress | completed | invoiced`), baseado no sistema de referência do
Alcides (vídeo `IMG_0949.MOV`). Mudanças em relação ao modelo antigo:

- `quoted`+`approved` viraram só `diagnostico`: a OS nasce em
  `diagnostico` (é o orçamento, ainda "sem O.S." no sentido do sistema de
  referência) e a aprovação já abre a OS direto em `em_servico` — não há
  mais um estágio intermediário "aprovado mas execução não iniciada".
- `in_progress` virou `em_servico`; `completed` virou `finalizado`.
- `draft` (que nunca foi usado) foi removido do tipo.
- Novo: itens de linha "avulsos" — no Diagnóstico, dá pra lançar um preço
  sem vincular a um `ServiceItem` do catálogo (campo separado em
  `NewOrderForm`), pra quando o valor já é estimável mas o serviço/peça
  exato ainda não foi definido. Gera um `OrderLineItem` normal, só com
  `itemId` gerado no cliente em vez do id de um item real do catálogo.

Não existe migração de dados antigos — como é MVP sem dados de produção
reais, a troca foi direta no código; qualquer OS de teste criada com os
status antigos ficaria com um `status` que não bate mais com o tipo
(não há dados assim conhecidos hoje).

### 6.6 Git push: Bash é bloqueado pelo classificador de auto mode
Comandos `git push` (mesmo com token embutido na URL) são bloqueados pelo
classificador de permissões deste ambiente — não adianta tentar de novo
pela mesma via. O fluxo que funciona: gerar um Personal Access Token
classic no GitHub (`repo` + `workflow` scopes) via navegador, pedir para o
usuário rodar `git push origin main` no terminal dele e colar o token
quando pedir senha, depois **deletar o token** no GitHub por segurança
assim que confirmado que o push chegou (`git fetch && git log
origin/main -1`).

### 6.7 `.env.local` nunca vai pro Git
Credenciais do Firebase ficam em `frontend-web/.env.local`, protegido pelo
`.gitignore`. Nunca commitar isso — `.env.example` (sem valores reais) é o
que fica versionado como referência.

### 6.8 Commit só depois da homologação do Alcides (ver callout no topo)
Terminar de implementar uma mudança **não** é sinal pra commitar. O passo
seguinte é sempre: deixar rodando em `localhost:3000` e avisar que está
pronto pra ele navegar/testar (ele chama isso de "homologação"). Só
depois que ele confirmar que está funcionando como esperado — sem pedir
ajuste — é que `git add`/`commit`/`push` acontecem.

Isso vale mesmo quando a mudança já foi verificada por mim no navegador
(via `mcp__Claude_Browser__*`) e está funcionando tecnicamente — "eu
testei e funciona" não substitui a homologação dele. Testar no navegador
antes de avisar continua sendo importante (evita pedir homologação de
algo quebrado), só não é o gate final.

**Origem:** depois do refactor do workflow de OS (v0.3.0), eu committei e
dei push logo em seguida de verificar via browser automation, sem esperar
o Alcides navegar. Ele corrigiu: quer poder homologar localmente primeiro,
porque pode surgir melhoria a ser pedida antes de ir pra produção — commit
prematuro significa ter que emendar em cima de algo ainda não validado.

**Não confundir com a seção 7/`docs/ROADMAP.md`** (decisões de completar
deploy/infra até o fim sem pausar por autorização extra) — aquilo é sobre
*completude* do trabalho antes de considerar terminado; isso aqui é sobre
*quando publicar* (`git commit`/`push`) o que já foi implementado.

### 6.9 A conta "de teste" é a conta real — não criar outra
Durante o desenvolvimento, criei uma conta `teste@mecos.com` só pra testar
telas. O catálogo completo de 165 itens (extraído de vídeo, ver v0.2.2) e
os dados de exemplo acabaram todos nela. Quando o Alcides testou o sistema
pela primeira vez sozinho (via `INICIAR_MECOS.command`), ele não tinha
essas credenciais — ou tentou logar sem sucesso, ou cadastrou uma oficina
nova (tenant zerado) — e não achou a lista de serviços/peças (estava lá,
só que na conta errada para ele).

**Resolução (2026-08-13):** em vez de recriar/migrar os dados pra uma
conta com e-mail "de verdade", o Alcides decidiu manter
`teste@mecos.com` como a conta real e só renomear a oficina para
"RRadiadores" (`clients/{uid}.name`, trocado via script one-off com o
SDK cliente do Firebase autenticado como o próprio dono — não existe
Admin SDK/service account configurado neste projeto, então qualquer
escrita direta no Firestore fora da UI precisa logar como o usuário dono
e respeitar as mesmas regras de segurança).

**Lição:** não criar uma segunda conta "de teste" nova para verificar
features — usar `teste@mecos.com` (a conta canônica, ver callout no topo
do arquivo). Se algum teste puder poluir os dados reais da oficina (ex.:
criar uma OS de teste), limpar depois ou avisar o Alcides do que foi
deixado para trás.

### 6.10 Como publicar `firebase/firestore.rules` (manual, sem CLI)
Este projeto não tem `firebase-tools` nem Admin SDK configurado — toda
publicação de regra é manual, pelo console do Firebase (mesma limitação
documentada na seção 6.6 pro git push, motivo diferente: lá é o
classificador de auto mode bloqueando `git push`; aqui é falta de
ferramenta/autenticação de infra neste ambiente). Passo a passo:

1. Abrir [console.firebase.google.com](https://console.firebase.google.com/),
   projeto `sistema-os-ef1ef` → Firestore Database → aba **Regras**.
2. Copiar o conteúdo de `firebase/firestore.rules` (arquivo local deste
   repo) e colar substituindo o conteúdo do editor no console.
3. Clicar em **Publicar**.
4. Confirmar testando a criação de um usuário na tela "Usuários" — se
   der certo, a mensagem de erro vira uma linha nova na tabela.

**Feito nesta sessão (2026-08-13):** confirmado que com a regra antiga
ainda ativa, `users/{uid}` grava normalmente (regra não mudou), mas
`clients/{clientId}/members/{uid}` falhava com
`FirebaseError: permission-denied`. A regra nova foi publicada via
Claude in Chrome (autorização explícita do Alcides — é infraestrutura
live, não só arquivo local) e testada com sucesso ponta a ponta (ver
callout no topo do arquivo). **Cuidado ao colar regra no editor do
console**: ele tem autoclose de `{`/`}` que pode duplicar chaves se
colado via simulação de teclado em vez de paste de verdade — escrever
tudo numa linha só (sem quebras de linha, comentários `//` removidos)
evitou o problema nesta sessão.

### 6.11 Padrão obrigatório: toda busca de informação é "filtra ao digitar"
**Regra geral do projeto (pedido explícito do Alcides, 2026-08-13):**
qualquer tela que precise localizar um item dentro de uma lista — hoje ou
no futuro — usa busca com filtro em tempo real (digitou, filtrou), nunca
"lista tudo e o usuário procura visualmente". Isso vale mesmo pra listas
que hoje são pequenas, se a tendência é crescer.

Utilitário compartilhado: `lib/utils/search.ts`, função `normalize(s)`
(remove acento, minúsculas) — **sempre importar daqui**, não duplicar a
função em cada tela (já foi duplicada uma vez entre `orders/page.tsx` e
`services/page.tsx` antes de virar utilitário — não repetir).

**Onde já está implementado:**
- `app/(app)/orders/page.tsx` (seletor de item na Nova OS): campo de busca
  com **dropdown** de até 8 resultados, navegável por teclado (↑↓/Enter) —
  porque aqui a ação é "escolher 1 item pra adicionar à lista". Bug
  original: catálogo de ~165 itens renderizado inteiro como botões de uma
  vez (`services.map(...)`), sem busca — reportado pelo Alcides como
  "confusão", com print de tela.
- `app/(app)/services/page.tsx` (catálogo): campo de busca que **filtra a
  própria tabela** (sem dropdown — aqui a ação é "ver/gerenciar os itens
  que batem", não escolher um só). Mesmo bug original: tabela inteira
  sempre visível sem filtro.

**Armadilha real já acontecida nessa tela (2026-08-13):** a primeira
versão colocava a busca **abaixo** do formulário de "+ Adicionar" — o
campo "Nome" do formulário e o campo de busca ficavam parecidos e
próximos, e o Alcides digitou no campo errado (o do formulário), achando
que era a busca, e reportou "a busca não funciona". Corrigido: busca
sempre **primeiro**, com label própria ("Buscar no catálogo") e destaque
visual (campo maior, `autoFocus`); formulário de cadastro escondido atrás
de um toggle ("+ Cadastrar novo item", igual ao padrão já usado em
"Importar em lote") pra não competir visualmente com a busca. **Padrão
pra qualquer tela nova**: busca é a primeira coisa na tela, formulário de
criar/cadastrar fica secundário (colapsado) quando a tela também lista
muitos itens.

**Onde ainda não tem** (Clientes, Veículos, Usuários): listas pequenas
hoje, não reportado como problema ainda. Se crescerem ou se alguém
reclamar, aplicar o mesmo padrão — filtro na própria tabela, como em
Serviços e Peças, é o modelo a copiar (mais simples que o dropdown de
Nova OS, que só se justifica quando a ação é "inserir item em outra
lista").

---

## 7. Fluxo de Deploy Atual

- **Frontend:** só roda local. Duas formas de subir o servidor:
  - **Alcides, duplo clique:** [`INICIAR_MECOS.command`](INICIAR_MECOS.command)
    na raiz do projeto — instala dependências na primeira vez, roda
    `npm run dev` e abre `http://localhost:3000` sozinho. Mesmo padrão do
    `INICIAR_CONCILIADOR.command` do outro projeto dele. Esse é o caminho
    esperado para a **homologação** (ver callout no topo deste arquivo e
    seção 6.8) — ele sobe o sistema sozinho, sem depender de mim.
  - **Claude Code:** `npm run dev` dentro de `frontend-web/`, via
    `.claude/launch.json` global do usuário, entrada `sistema-os-web`
    (usado pra eu testar via browser automation antes de pedir
    homologação — não deixar rodando depois, pra não conflitar com a
    porta 3000 quando ele for usar o `.command`).
  **Ainda não publicado no Hostinger** — existe um workflow do GitHub
  Actions (`.github/workflows/deploy.yml`) preparado mas incompleto (sem
  secrets configurados, sem script de deploy real).
- **Backend:** Firebase Auth + Firestore já estão em produção real (projeto
  `sistema-os-ef1ef`, região São Paulo). Cloud Functions existe só como
  placeholder, nada em uso.
- **Mobile:** estrutura Expo criada (`mobile/`), mas **nenhuma tela
  implementada** — só o placeholder inicial do `App.tsx`.

---

## 8. Roadmap / Próximas Fases

- **Fase 3 (em andamento):** conectar um provedor real de NF no lugar do
  `mockInvoiceProvider` — provavelmente Nota Gateway (ex-eNotas), decisão
  final pendente. Base técnica já documentada em `docs/ENOTA-API.md`.
- **Fase 4 (não iniciada):** geração automática de XMLs para a
  contabilidade (comércio) e arquivos de NF de serviço — depende da Fase 3
  estar concluída com um provedor real emitindo notas de verdade.
- **Deploy real:** publicar o frontend no Hostinger, configurar secrets do
  GitHub Actions.
- **Mobile:** implementar as telas do app Expo (hoje só scaffold).
- **Multi-usuário por oficina:** se necessário, revisar o modelo
  `clientId === uid` (seção 3) para suportar convite de funcionários.

---

## 9. Histórico de Versões

> Atualizar esta seção a cada mudança relevante — resumo curto, não
> changelog verboso linha-a-linha (isso já existe no `git log`).

- **v0.4.2** (2026-08-13) — Corrigido bug real em `services/page.tsx`: a
  busca ficava logo abaixo do campo "Nome" do formulário de cadastro,
  visualmente parecidos, e o Alcides digitou no campo errado achando que
  era a busca ("aditi" no formulário, não no filtro). Reordenado: busca
  primeiro (label própria, campo maior, `autoFocus`), formulário de
  cadastro escondido atrás de toggle. Ver seção 6.11.
- **v0.4.1** (2026-08-13) — Busca com filtro em tempo real virou padrão
  obrigatório do projeto (pedido do Alcides, após reportar que
  `/services` não filtrava ao digitar). `normalize()` extraído de
  `orders/page.tsx` pra `lib/utils/search.ts` (compartilhado, evita
  duplicar); aplicado também em `services/page.tsx` (filtra a tabela).
  Ver `CLAUDE.md` seção 6.11 pra onde aplicar isso em telas futuras.
- **v0.4.0** (2026-08-13) — Multi-tenant deixou de exigir `clientId ==
  uid`: oficina ganhou cadastro próprio (nome fantasia, razão social,
  CNPJ, endereço — tela "Oficina") e suporte a múltiplos usuários com
  papel — gestor, supervisor, mecânico, recepcionista (tela "Usuários",
  criação via segunda instância do Firebase App pra não derrubar a
  sessão do gestor). Regra de segurança reescrita com lookup
  `users/{uid}.clientId` (`isMember()`) — **ainda não publicada no
  Firestore do projeto, ver callout no topo do arquivo e seção 6.10**.
  Seletor de serviços/peças na Nova OS trocado de "lista tudo" pra busca
  com autocomplete (bug de UX reportado pelo Alcides com print de tela).
  Pesquisa de mercado sobre oficinas mecânicas gerada e publicada como
  artifact pro Alcides avaliar (não implementado, só sugestões). Ver
  seção 3.1, 5.10, 5.11, 6.10, 6.11.
- **v0.3.2** (2026-08-13) — Investigado por que o Alcides não achava a
  lista de Serviços e Peças ao homologar: o catálogo estava correto, mas
  preso numa conta de teste (`teste@mecos.com`) sem credenciais dele —
  cada login é um tenant isolado, sem dado compartilhado. Decisão dele:
  manter essa conta como a real, só renomeando a oficina para
  "RRadiadores" (`clients/{uid}.name`, editado via script one-off, sem
  UI própria ainda). Documentado como conta canônica no topo do arquivo e
  na seção 6.9, pra não repetir o problema criando outra conta de teste.
- **v0.3.1** (2026-08-13) — Adicionado `INICIAR_MECOS.command` (duplo
  clique na raiz do projeto pra instalar dependências na primeira vez,
  subir o servidor e abrir o navegador sozinho), mesmo padrão do
  `INICIAR_CONCILIADOR.command` do projeto ContFácil. Documentado o novo
  fluxo de trabalho: commit só depois de homologação local do Alcides
  (callout no topo deste arquivo + seção 6.8) — esse `.command` é o
  caminho pra ele rodar o sistema sozinho pra homologar.
- **v0.3.0** (2026-08-13) — Workflow de OS refeito para o modelo de 3
  estágios do sistema de referência: `OrderStatus` agora é `diagnostico |
  em_servico | finalizado | invoiced` (era `draft | quoted | approved |
  in_progress | completed | invoiced`). A aprovação do orçamento agora
  abre a OS direto em "Em Serviço" num só passo (sem estágio
  intermediário "aprovado mas não iniciado"). Novo: item avulso no
  formulário de criação — permite lançar um preço estimado no Diagnóstico
  sem vincular a um serviço/peça do catálogo. Ver `CLAUDE.md` seção 6.5 e
  `docs/MODULOS.md` seção 6.
- **v0.2.2** (2026-08-13) — Catálogo de Serviços e Peças ganhou campos
  `código`/`cód. barras`, importação em lote (textarea, formato
  `código;barras;nome;tipo;preço`) e exclusão por linha
  (`deleteService`/`updateService` em `lib/firebase/firestore.ts`, esse
  último ainda sem UI). Catálogo completo do sistema legado (~165 itens)
  extraído de vídeos e importado, com duplicatas resolvidas manualmente.
- **v0.2.0** (2026-08-13) — Ambiente de emissão de NF criado
  (provider-agnostic, `mockInvoiceProvider`), tela "Notas Fiscais" com fila
  + emissão em lote + visualização de documento de teste. Pesquisa completa
  da API eNotas/Nota Gateway documentada em `docs/ENOTA-API.md`
  (multi-tenant confirmado). Correção de `overflow-x-auto` em todas as
  tabelas. Criação deste arquivo `CLAUDE.md`.
- **v0.2.1** (2026-08-13) — Documentação expandida: `docs/MODULOS.md`
  (detalhamento funcional campo a campo), `docs/GUIA-VISUAL.md` (padrão
  visual extraído do código real), `docs/TESTES.md` (checklist de
  verificação manual — não há testes automatizados ainda),
  `docs/ROADMAP.md` (fases com critério de "pronto"). `README.md`
  reescrito para refletir o estado real do projeto (estava desatualizado
  desde a Fase 1). Também foi criado
  `~/projetos/TEMPLATE-NOVO-PROJETO.md`, um guia reutilizável para
  scaffolding de documentação em projetos futuros, baseado no processo
  usado aqui.
- **v0.1.0** (2026-08-12/13) — Fase 1 (setup Next.js + Expo + Firebase,
  Auth + Firestore configurados, regras de segurança publicadas) e Fase 2
  (CRUD completo: clientes, veículos, serviços/peças, OS com workflow
  orçamento→aprovação→execução→conclusão, dashboard, relatórios com
  export CSV, sistema de sugestões com export JSON) implementadas e
  testadas ponta a ponta no navegador. Repositório criado e publicado no
  GitHub.
