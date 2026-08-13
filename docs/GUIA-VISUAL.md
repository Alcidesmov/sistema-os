# Guia Visual — MecOS

Padrão visual observado no código já escrito (Tailwind CSS, sem biblioteca
de componentes — tudo classe utilitária direta no JSX). Este documento
existe pra **manter consistência** ao adicionar telas novas — não é uma
decisão de design de marca formal, é a extração do que já está em uso.

> Regra prática: antes de estilizar uma tela nova, escolha os componentes
> mais parecidos já existentes (ex.: `app/(app)/customers/page.tsx` para
> qualquer tela de "lista + formulário simples") e copie as classes de lá
> em vez de inventar um padrão novo.

---

## Cores

Não há paleta de marca customizada no `tailwind.config.ts` — usamos as
cores padrão do Tailwind diretamente. Uso observado por função:

| Função | Classe | Onde |
|---|---|---|
| Texto principal | `text-gray-900` | Títulos, valores em destaque, nomes |
| Texto secundário | `text-gray-600` | Corpo de texto, valores de tabela |
| Texto terciário/legenda | `text-gray-500` | Datas, labels pequenos |
| Texto desabilitado/placeholder | `text-gray-400` | Estados vazios ("Nenhum X cadastrado ainda") |
| Fundo de página | `bg-gray-50` | `<body>`/containers principais |
| Fundo de card/tabela | branco (`bg-white`, implícito) | Cards, formulários, tabelas |
| Borda padrão | `border-gray-200` | Cards, divisórias de seção |
| Borda de input | `border-gray-300` | Todo `<input>`/`<select>`/`<textarea>` |
| Ação primária | `bg-blue-600` (hover `bg-blue-700`) | Botões principais: salvar, criar, aprovar |
| Ação neutra/exportar | `bg-gray-800` (hover `bg-gray-900`) | Exportar CSV/JSON |
| Sucesso/conclusão | `bg-green-600` / badge `bg-green-100 text-green-700` | "Concluir serviço", status "Concluída"/"Faturada" |
| Execução em andamento | `bg-purple-600` / badge `bg-purple-100 text-purple-700` | "Iniciar serviço", status "Em execução" |
| Aguardando ação/atenção | `bg-amber-50 border-amber-300 text-amber-800` (banner) / badge `bg-amber-100 text-amber-700` | Avisos (ex.: banner "modo de teste"), status "Aguardando aprovação" |
| NF / financeiro | `bg-teal-600` / badge `bg-teal-100 text-teal-700` | Ações e status relacionados a nota fiscal |
| Erro/destrutivo | `text-red-600` | Mensagens de erro, links "remover" |

**Badges de status de OS** (`STATUS_COLOR` em `orders/page.tsx` e
`orders/[id]/page.tsx`) sempre seguem o padrão `bg-{cor}-100 text-{cor}-700`
com `rounded-full px-2 py-1 text-xs font-medium`.

---

## Tipografia

Fonte: padrão do sistema (`-apple-system, BlinkMacSystemFont...`,
definida em `app/globals.css`) — sem fonte customizada carregada.

| Uso | Classes |
|---|---|
| Título de página (`<h1>`) | `text-2xl font-bold text-gray-900` |
| Título de card/seção | `text-sm font-semibold text-gray-900` |
| Corpo padrão | `text-sm` (tamanho base de quase toda a UI) |
| Labels de formulário | `text-xs font-medium text-gray-600` |
| Texto pequeno/legenda | `text-xs` |

---

## Espaçamento e Bordas

- Padding padrão de célula de tabela: `px-4 py-3`
- Padding padrão de botão: `px-4 py-2` (botões menores: `px-3 py-2`)
- Cantos de card/formulário: `rounded-xl`
- Cantos de botão/input: `rounded-lg`
- Cantos de badge/pill: `rounded-full`
- Borda de card: `border border-gray-200`

## Componentes-padrão

### Botão primário
```html
<button class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
```

### Input de texto
```html
<input class="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
```

### Card de conteúdo
```html
<div class="rounded-xl border border-gray-200 bg-white p-4">
```

### Tabela de listagem (sempre com wrapper de scroll!)
```html
<div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
        ...
      </thead>
      <tbody class="divide-y divide-gray-100">...</tbody>
    </table>
  </div>
</div>
```
**Nunca esqueça o `overflow-x-auto`** — sem ele a tabela estoura a tela em
viewports estreitas (bug real já corrigido uma vez, ver `CLAUDE.md` seção 6.2).

### Estado vazio (lista sem itens)
```html
<tr><td colSpan={N} class="px-4 py-8 text-center text-gray-400">
  Nenhum [item] cadastrado ainda
</td></tr>
```

### Badge de status
```html
<span class="rounded-full bg-{cor}-100 px-2 py-1 text-xs font-medium text-{cor}-700">
```

---

## Layout geral

- Sidebar fixa de 224px (`w-56`) à esquerda com navegação, sempre visível
  na área logada (`components/layout/DashboardShell.tsx`).
- Conteúdo principal com padding `p-6`, sem largura máxima definida (usa
  a largura toda disponível — algumas telas de detalhe limitam com
  `max-w-2xl`, ex.: `orders/[id]/page.tsx`).
- Botão flutuante de feedback: `fixed bottom-5 right-5`, sempre por cima
  do conteúdo (`z-50` no modal).

## O que **não** existe ainda (não inventar sem necessidade)

- Modo escuro
- Fontes customizadas / identidade de marca (logo, ícone próprio)
- Biblioteca de componentes (Shadcn/Radix) — apesar de ter sido cogitada
  no início do projeto, **não foi usada** na prática; todo componente é
  HTML+Tailwind puro
- Animações/transições além de `hover:` simples
