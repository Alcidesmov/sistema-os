# CLAUDE.md — MecOS (Sistema de OS para Oficinas Mecânicas)

> Este arquivo é lido automaticamente pelo Claude Code no início de cada
> sessão neste projeto. É a fonte de verdade sobre visão, arquitetura,
> módulos e decisões — **deve ser atualizado a cada mudança relevante**,
> junto com o commit que a introduz. Ver seção "Histórico de Versões" no
> final.

**Versão atual: v0.2.0** — Fase 1 (setup) e Fase 2 (CRUD de OS + workflow)
completas. Ambiente de emissão de NF pronto em modo de teste (Fase 3 em
andamento, provedor real ainda não conectado).

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

Cada oficina-cliente é um **tenant** isolado no Firestore. O modelo atual
(MVP) é:

```
clientId === uid do usuário dono da oficina no Firebase Auth
```

Ou seja: **não há convite/múltiplos usuários por oficina ainda** — quem
cria a conta é automaticamente o único dono/operador daquela oficina. Isso
é decidido em `lib/hooks/useClientId.tsx`: no primeiro login, se não existe
`users/{uid}`, o sistema cria esse documento com `clientId: uid` e um
documento `clients/{uid}` — bootstrap automático, sem tela de onboarding
separada.

**Implicação para evolução futura:** se for necessário suportar múltiplos
funcionários por oficina (ex.: dono + mecânico com login próprio), isso
exige mudar esse modelo — hoje `clientId` e `uid` são o mesmo valor, então
"convidar" um segundo usuário para a mesma oficina não tem suporte nativo.

### Estrutura Firestore

```
users/{uid}                        → { clientId, email, role: 'owner', createdAt }
clients/{clientId}                 → { name, ownerUid, createdAt, cnpj?, email?, phone? }
clients/{clientId}/customers/{id}  → clientes da oficina (donos dos veículos)
clients/{clientId}/vehicles/{id}   → veículos cadastrados
clients/{clientId}/services/{id}   → catálogo de serviços/peças com preço
clients/{clientId}/orders/{id}     → Ordens de Serviço
clients/{clientId}/invoices/{id}   → Notas Fiscais emitidas (hoje, documentos de teste)
clients/{clientId}/feedback/{id}   → sugestões de melhoria enviadas na UI
```

### Segurança (`firebase/firestore.rules`)

Regra única e simples: só o próprio dono (`request.auth.uid == clientId`)
lê/escreve em `clients/{clientId}` e tudo abaixo dele (wildcard
`{document=**}`). Modo de produção desde o início (nada aberto por
padrão). **Isso já está publicado no Firestore do projeto**, não é só um
arquivo local — foi aplicado manualmente via console do Firebase.

---

## 4. Modelo de Dados (TypeScript)

Fonte de verdade: `frontend-web/lib/types/index.ts`.

- **`Customer`** — cliente da oficina: `name`, `phone`, `email?`, `document?`.
- **`Vehicle`** — `plate`, `brand`, `model`, `year`, `color`, `type`
  (`carro | moto | caminhao | outro`), `customerId`.
- **`ServiceItem`** — item de catálogo: `name`, `price`, `type`
  (`service | part`). Usado para montar orçamentos rapidamente.
- **`Order`** — a Ordem de Serviço. Campos-chave:
  - `status: OrderStatus` = `draft | quoted | approved | in_progress | completed | invoiced`
    (`draft` existe no tipo mas **não é usado na prática** — toda OS já
    nasce como `quoted`, ver seção 6.5)
  - `items: OrderLineItem[]` — linhas do orçamento (serviço/peça, qtd,
    preço unitário, subtotal)
  - `totalValue`, `quoteApprovedAt?`, `executionStartedAt?`,
    `executionEstimatedEnd?`, `executionCompletedAt?`
  - `invoiceRequested?: boolean` — dono da oficina "flegou" pra emitir NF
  - `invoiceId?: string` — preenchido quando a NF é de fato emitida
- **`Invoice`** — nota fiscal (hoje, sempre gerada pelo `mockProvider`):
  `orderId`, `provider`, `kind` (`nfe | nfse`), `number`, `totalValue`,
  `documentContent` (HTML do documento), `documentUrl?`, `issuedAt`.
- **`Client`** — a oficina: `name`, `cnpj?`, `email?`, `phone?`.

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
  placa+modelo de um novo; clica nos itens do catálogo pra montar o
  orçamento (quantidade soma automaticamente se clicar de novo no mesmo
  item); total calculado em tempo real. Ao submeter, cria cliente/veículo
  novos se necessário e a OS já nasce com `status: 'quoted'`.
- **Detalhe e workflow** (`orders/[id]/page.tsx`): botões de ação mudam
  conforme o `status` atual:
  - `quoted` → botão "Aprovar orçamento" → `approved`
  - `approved` → campo de prazo opcional + botão "Iniciar serviço" →
    `in_progress`
  - `in_progress` → botão "Concluir serviço" → `completed`
  - `completed` (sem `invoiceRequested`) → botão "Marcar para emissão de
    NF" → seta `invoiceRequested: true` (não muda o `status` ainda)
  - Depois de flegado, a OS entra na fila do módulo de Notas Fiscais (5.7)
- **`app/(app)/orders/page.tsx` também é a tela de listagem** — tabela com
  status colorido, cliente, veículo, total, data.

### 5.7 Notas Fiscais (`app/(app)/invoices/page.tsx`)
Fila de OS `completed` + `invoiceRequested: true` que ainda não têm
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

### 6.5 `OrderStatus` tem um valor (`draft`) que não é usado
O tipo `OrderStatus` inclui `'draft'`, mas nenhuma OS é criada com esse
status hoje — `createOrder` sempre grava `status: 'quoted'` direto (criar
o orçamento = já é a submissão pro cliente aprovar). Se um fluxo de
rascunho salvo-mas-não-enviado for necessário no futuro, `draft` já existe
no tipo, só falta a UI usar.

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

---

## 7. Fluxo de Deploy Atual

- **Frontend:** só roda local (`npm run dev` dentro de `frontend-web/`, via
  `.claude/launch.json` global do usuário, entrada `sistema-os-web`).
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

- **v0.2.0** (2026-08-13) — Ambiente de emissão de NF criado
  (provider-agnostic, `mockInvoiceProvider`), tela "Notas Fiscais" com fila
  + emissão em lote + visualização de documento de teste. Pesquisa completa
  da API eNotas/Nota Gateway documentada em `docs/ENOTA-API.md`
  (multi-tenant confirmado). Correção de `overflow-x-auto` em todas as
  tabelas. Criação deste arquivo `CLAUDE.md`.
- **v0.1.0** (2026-08-12/13) — Fase 1 (setup Next.js + Expo + Firebase,
  Auth + Firestore configurados, regras de segurança publicadas) e Fase 2
  (CRUD completo: clientes, veículos, serviços/peças, OS com workflow
  orçamento→aprovação→execução→conclusão, dashboard, relatórios com
  export CSV, sistema de sugestões com export JSON) implementadas e
  testadas ponta a ponta no navegador. Repositório criado e publicado no
  GitHub.
