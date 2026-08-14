# Detalhamento Funcional dos Módulos — MecOS

Este documento descreve, tela por tela, o que cada módulo faz, quais
campos existem e quais regras de negócio estão implementadas. É o
complemento "funcional" do `CLAUDE.md` (que é mais focado em arquitetura
e convenções técnicas). Se um comportamento aqui descrito não bate com o
código, o código é a verdade — atualize este arquivo.

---

## 1. Autenticação

**Rota:** `/login` · **Arquivo:** `app/login/page.tsx`

- Uma única tela alterna entre "Entrar" e "Cadastrar sua oficina" (toggle,
  não são rotas separadas).
- Campos: e-mail, senha (mínimo 6 caracteres, exigido pelo Firebase Auth).
- **Cadastro = criação de uma oficina nova.** Não existe uma tela
  separada de "criar empresa" — ao criar a conta, o sistema
  automaticamente:
  1. Cria `users/{uid}` com `clientId = uid`, `role: 'gestor'`
  2. Cria `clients/{uid}` com nome derivado do e-mail (parte antes do `@`)
  3. Cria `clients/{uid}/members/{uid}` (pra aparecer na tela "Usuários")
  4. Redireciona para o dashboard
- Erros de login/cadastro mostram mensagem genérica (não expõe se o
  e-mail existe ou não, por segurança).
- **Esse formulário só serve pra criar uma oficina nova.** Funcionários
  de uma oficina existente (supervisor/mecânico/recepcionista) não usam
  "Cadastrar" — o gestor cria o login deles direto na tela "Usuários"
  (seção 12) e passa a senha; eles só usam "Entrar" aqui.

---

## 2. Dashboard (Visão Geral)

**Rota:** `/dashboard` · **Arquivo:** `app/(app)/dashboard/page.tsx`

Cartões de estatística (calculados client-side a partir de todas as OS
carregadas via `onSnapshot`, não é uma agregação no servidor):

| Cartão | Cálculo |
|---|---|
| OS hoje | OS com `createdAt >=` início do dia atual |
| Aguardando aprovação | OS com `status === 'quoted'` |
| Em execução | OS com `status === 'in_progress'` |
| Faturamento do mês | Soma de `totalValue` de OS criadas no mês corrente |

Abaixo, lista das 8 OS mais recentes (nome do cliente, veículo, valor),
cada uma linkando para o detalhe.

**Limitação conhecida:** como tudo é calculado no cliente a partir de
todas as OS, isso não escala bem para oficinas com milhares de OS —
funciona bem para o volume esperado do MVP, mas se isso virar gargalo,
considerar agregação no servidor (Cloud Function) ou paginação.

---

## 3. Clientes

**Rota:** `/customers` · **Arquivo:** `app/(app)/customers/page.tsx`

Formulário inline no topo da lista (sem modal/rota separada):

| Campo | Obrigatório | Observação |
|---|---|---|
| Nome | Sim | — |
| Telefone | Sim | Sem máscara/validação de formato |
| E-mail | Não | — |

Não há edição nem exclusão de clientes na UI ainda — só criar e listar.
Diferente de Serviços e Peças (que já tem exclusão, ver seção 5).
Não há verificação de duplicidade (pode cadastrar o mesmo cliente duas
vezes com nomes diferentes).

---

## 4. Veículos

**Rota:** `/vehicles` · **Arquivo:** `app/(app)/vehicles/page.tsx`

| Campo | Obrigatório | Observação |
|---|---|---|
| Placa | Sim | Convertida para maiúsculas automaticamente, sem validação de formato Mercosul/antigo |
| Marca | Não | — |
| Modelo | Sim | — |
| Ano | Não | Texto livre, não é `number` |
| Cor | Não | — |
| Tipo | Sim | `carro \| moto \| caminhao \| outro`, usado no relatório por tipo |
| Cliente | Sim | Select vinculando a um `Customer` já cadastrado |

Um veículo pertence a exatamente um cliente (`customerId`). Não há
edição/exclusão na UI ainda.

---

## 5. Serviços e Peças (catálogo)

**Rota:** `/services` · **Arquivo:** `app/(app)/services/page.tsx`

Catálogo de itens reutilizáveis para montar orçamentos rapidamente.

**Busca** (desde v0.4.1, layout corrigido em v0.4.2): é a **primeira
coisa na tela**, com label "Buscar no catálogo" e foco automático —
filtra por nome, código ou código de barras conforme digita
(`normalize()` de `lib/utils/search.ts`). Sem isso, o catálogo de ~165
itens ficava ilegível de rolar. Ver `CLAUDE.md` 6.11 pro padrão geral.

**Cadastrar novo item**: formulário escondido atrás do link "+ Cadastrar
novo item" (mesmo padrão do "Importar em lote" logo ao lado) — fica
fechado por padrão pra não competir visualmente com a busca (era logo
abaixo dela antes da v0.4.2, e o Alcides já digitou no campo "Nome" do
formulário achando que era a busca).

| Campo | Obrigatório |
|---|---|
| Código | Não — código interno de referência (ex.: do sistema legado da oficina), texto livre |
| Cód. barras | Não — texto livre |
| Nome | Sim |
| Tipo | Sim — `service` (serviço) ou `part` (peça) |
| Preço | Sim — número, formatado como BRL na exibição |

O tipo (`service`/`part`) importa para: (a) exibição na listagem, e (b)
no `mockInvoiceProvider`, decide se a nota gerada é classificada como
`nfse` (só serviços) ou `nfe` (tem pelo menos uma peça) — ver seção 8.

**Exclusão**: cada linha tem um botão "excluir" (`deleteService` em
`lib/firebase/firestore.ts`) — sem confirmação, remove direto. Não há
edição inline ainda; pra corrigir um item hoje o fluxo é excluir e
recriar pelo formulário (`updateService` já existe em `firestore.ts` mas
não está ligado a nenhuma UI).

**Importação em lote**: botão "Importar em lote" abre um textarea onde
cada linha é um item no formato `código;cód.barras;nome;tipo(S ou
P);preço` (usado para trazer o catálogo do sistema legado). Usado uma
vez para importar o catálogo completo (~165 itens) a partir de vídeos do
sistema antigo — ver `docs/ROADMAP.md`.

---

## 6. Ordens de Serviço (módulo central)

**Rotas:** `/orders` (lista + criação) e `/orders/[id]` (detalhe/workflow)

### 6.1 Criação (`orders/page.tsx`, componente `NewOrderForm`)

Fluxo desenhado para **mínimo de cliques**, tudo numa única tela:

1. **Cliente**: select de clientes existentes, OU deixar em branco e
   preencher nome+telefone de um cliente novo (criado no submit).
2. **Veículo**: select filtrado pelos veículos do cliente escolhido, OU
   deixar em branco e preencher placa+modelo de um veículo novo (criado
   com `brand/year/color` vazios e `type: 'carro'` por padrão — **não há
   como escolher o tipo do veículo nesta tela**, só na tela de Veículos).
3. **Itens**: campo de busca com autocomplete (desde v0.4.0 — antes
   listava todos os ~165 itens do catálogo como botões de uma vez, virou
   ilegível e foi trocado). Digita nome, código ou código de barras;
   dropdown com até 8 resultados, navegável por ↑↓/Enter; clicar (ou
   Enter) adiciona à lista e limpa a busca. Clicar de novo no mesmo item
   soma a quantidade. Botão "remover" por item. Total recalculado em
   tempo real.
4. **Item avulso**: campo separado (descrição + tipo + preço) para lançar
   um valor estimado **sem vincular a um item do catálogo** — pensado
   para o estágio de Diagnóstico, quando ainda não se sabe qual
   serviço/peça exato vai ser usado, mas já se quer registrar um preço.
   Gera uma linha normal em `items` (mesmo formato dos itens de
   catálogo), só que com um `itemId` gerado (`crypto.randomUUID()`) em
   vez do id de um `ServiceItem` real.
5. Submeter cria (se necessário) cliente/veículo novos e grava a OS já
   com **`status: 'diagnostico'`** — esse é o único ponto de entrada, não
   existe uma etapa de "rascunho" antes disso.

**Validação:** botão de submit só habilita se houver pelo menos 1 item no
orçamento (de catálogo ou avulso). Cliente/veículo são obrigatórios
(existente ou novo com os campos mínimos preenchidos).

### 6.2 Detalhe e workflow (`orders/[id]/page.tsx`)

Modelo de 3 estágios (mais um estágio final de faturamento), baseado no
sistema de referência do Alcides — ver vídeo `IMG_0949.MOV`: Diagnóstico
gera um orçamento; se aprovado, abre a O.S. e ela fica "Em Serviço"; ao
terminar, "Finalizado".

Mostra itens, total, timestamps de cada etapa, e os botões de ação mudam
conforme `status`:

| Status atual | Ação disponível | Efeito |
|---|---|---|
| `diagnostico` | Campo de prazo (opcional) + "Aprovar orçamento e abrir O.S." | → `em_servico`, grava `quoteApprovedAt` **e** `executionStartedAt` juntos (a aprovação já inicia a execução — não existe um estágio intermediário "aprovado mas não iniciado") e, se prazo preenchido, `executionEstimatedEnd` |
| `em_servico` | "Concluir serviço" | → `finalizado`, grava `executionCompletedAt` |
| `finalizado` (sem NF pedida) | "Marcar para emissão de NF" | Seta `invoiceRequested: true` — **não muda o status** |
| `finalizado` (com NF pedida, não emitida) | — | Mostra link "acompanhar na emissão em lote" → `/invoices` |
| `invoiced` | — | Mostra link "ver documento" → `/invoices` |

Não há botão de "voltar status" nem de cancelar uma OS — o fluxo é
estritamente sequencial pra frente. Não há mais um estágio `approved`
separado de `in_progress` (existia antes da v0.3.0 — ver `CLAUDE.md`
seção 6.5 para o histórico dessa mudança).

### 6.3 Listagem (`orders/page.tsx`, tabela abaixo do formulário)

Todas as OS da oficina, mais recentes primeiro. Colunas: cliente, veículo,
status (com badge colorida por status), total, data de criação. Clicar
na linha (no nome do cliente) vai para o detalhe.

---

## 7. Relatórios

**Rota:** `/reports` · **Arquivo:** `app/(app)/reports/page.tsx`

- Filtro por período: campos "De" e "Até" (input `type="date"`). Filtra
  por `createdAt` da OS — **não** por data de conclusão ou de emissão de
  NF.
- Cartões: total de OS no período, valor total no período.
- Tabela "Por tipo de veículo": agrupa as OS filtradas pelo `type` do
  veículo vinculado, soma quantidade e valor.
- Botão "Exportar CSV": baixa todas as OS do período filtrado (data,
  cliente, veículo, placa, tipo, status, valor) num arquivo `.csv` com
  BOM UTF-8 (abre corretamente acentuado no Excel).

**Limitação conhecida:** o requisito original pedia XMLs para
contabilidade (comércio) e arquivos de NF de serviço — isso **não está
implementado** aqui, depende da Fase 3/4 (integração real de NF, ver
`docs/ROADMAP.md`).

---

## 8. Notas Fiscais

**Rota:** `/invoices` · **Arquivo:** `app/(app)/invoices/page.tsx`

Banner fixo no topo avisa: **modo de teste**, nenhum provedor real
conectado ainda.

- **Fila "Aguardando emissão"**: toda OS com `status === 'completed'`,
  `invoiceRequested === true` e sem `invoiceId` ainda. Checkbox de seleção
  múltipla (com "selecionar todas") + botão "Emitir selecionadas".
- **Emissão em lote**: para cada OS selecionada, chama
  `emitInvoiceForOrder(clientId, order)` (`lib/firebase/firestore.ts`),
  que:
  1. Busca o documento `Client` da oficina
  2. Chama `activeInvoiceProvider.emit(order, client)` — hoje sempre o
     `mockInvoiceProvider`
  3. Grava um documento em `clients/{clientId}/invoices`
  4. Atualiza a OS: `status: 'invoiced'` + `invoiceId`
- **Lista "Emitidas"**: todas as notas já emitidas, com botão "Ver
  documento" que baixa um `.html` (o "documento de teste" gerado pelo
  mock — tem um aviso visual grande de que não tem valor fiscal).
- **Classificação NFS-e vs NF-e** (campo `kind` do mock): se a OS tem
  algum item `type: 'part'`, o mock marca como `nfe`; senão, `nfse`. Isso
  é só a lógica do **mock** — o provedor real pode (e provavelmente vai)
  precisar emitir NF-e **e** NFS-e separadamente para uma mesma OS mista,
  ver `docs/ENOTA-API.md` seção 9 (gaps).

---

## 9. Melhorias (sugestões)

**Rota:** `/feedback` · **Componentes:** `components/layout/FeedbackButton.tsx` + `app/(app)/feedback/page.tsx`

- Botão flutuante "💡 Sugerir melhoria" fica fixo no canto inferior
  direito, renderizado uma única vez no `DashboardShell` — aparece em
  **todas** as telas da área logada.
- Modal simples: textarea de mensagem. Ao enviar, grava
  `{ message, page (rota de origem), userEmail, status: 'new', createdAt }`.
- Tela `/feedback` lista tudo (mais recente primeiro), mostra a página de
  origem e o e-mail de quem enviou. Cada sugestão tem 4 pills de status
  clicáveis (`new / reviewing / done / rejected`) — clicar muda o status
  direto no Firestore, sem confirmação.
- Botão "Exportar JSON" baixa todas as sugestões (com todos os campos)
  num arquivo `.json` — atende diretamente o requisito original de
  "cair num JSON pra análise".

---

## 10. Oficina (desde v0.4.0)

**Rota:** `/oficina` · **Arquivo:** `app/(app)/oficina/page.tsx` · **Só gestor**

Cadastro da oficina: nome fantasia, razão social, CNPJ, telefone,
endereço, e-mail de contato. Pré-carrega de `clients/{clientId}`
(`watchClient`), salva com `updateClient` (grava só os campos
preenchidos, não sobrescreve com vazio — mesmo padrão condicional já
usado em outros formulários pro gotcha do `undefined`, ver `CLAUDE.md`
6.1). Papéis diferentes de gestor veem uma mensagem de acesso restrito em
vez do formulário.

## 11. Usuários (desde v0.4.0)

**Rota:** `/usuarios` · **Arquivo:** `app/(app)/usuarios/page.tsx` · **Só gestor**

- **Lista**: nome, e-mail, papel, data de criação — vem de
  `clients/{clientId}/members` (`watchMembers`).
- **Criar usuário**: formulário com nome, e-mail, senha temporária
  (pré-preenchida com uma senha aleatória de 8 caracteres, editável) e
  papel (gestor/supervisor/mecânico/recepcionista). Ao criar, mostra um
  aviso com e-mail+senha pra repassar ao funcionário — **não existe envio
  automático nem tela de "trocar senha"** ainda.
- Cria o login via `createMember` (`lib/firebase/members.ts`), que usa
  uma segunda instância do Firebase App pra não derrubar a sessão do
  gestor (ver `CLAUDE.md` seção 3.1 pro porquê técnico).
- Papéis diferentes de gestor veem uma mensagem de acesso restrito em vez
  da tela.

---

## Padrões transversais (valem para toda tela de listagem)

- **Tempo real**: todas as listas usam `onSnapshot` do Firestore — mudanças
  aparecem automaticamente sem precisar recarregar a página.
- **Sem paginação**: toda lista carrega 100% dos documentos da coleção de
  uma vez. Aceitável para o volume do MVP; revisar se alguma oficina
  crescer muito (milhares de registros).
- **Sem edição/exclusão** na maioria dos cadastros simples (clientes,
  veículos) — só criar e listar. Editar/excluir é um gap conhecido, não
  uma omissão acidental — não foi pedido ainda. Serviços e Peças é
  exceção: já tem exclusão (ver seção 5).
- **Formatação de moeda**: sempre via
  `value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
  — manter esse padrão em telas novas.
