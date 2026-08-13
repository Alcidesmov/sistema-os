# Testes e Verificação — MecOS

**Não há suite de testes automatizados neste projeto** (nenhum Jest,
Playwright, Vitest configurado). Toda verificação até agora foi **manual,
ao vivo, no navegador**, durante o desenvolvimento. Este documento registra
o que já foi testado e confirmado funcionando, e como re-testar cada fluxo
manualmente — serve como checklist de regressão até termos testes
automatizados de verdade.

> Ao adicionar uma feature nova, rode o fluxo manual relevante abaixo (ou
> escreva um novo checklist aqui) antes de considerar a tarefa concluída.
> Ver seção "Verificação" nas instruções gerais de desenvolvimento — telas
> devem ser testadas no navegador, não só compiladas sem erro.

---

## Cobertura confirmada (última verificação: 2026-08-13)

### ✅ Autenticação
- [x] Cadastro de nova conta (e-mail/senha) → bootstrap automático de
      oficina (`users/{uid}` + `clients/{uid}` criados)
- [x] Login com conta existente
- [x] Redirecionamento: `/` → `/login` (deslogado) ou `/dashboard` (logado)
- [x] Logout

### ✅ Cadastros simples (Clientes, Veículos, Serviços)
- [x] Criar cliente (nome + telefone, e-mail opcional) → aparece na lista
      em tempo real
- [x] Criar veículo vinculado a um cliente existente → aparece na lista
- [x] Criar serviço/peça no catálogo (nome, tipo, preço) → aparece na
      lista, formatado em BRL

### ✅ Ordens de Serviço — fluxo completo
- [x] Criar OS com cliente **novo** + veículo **novo** + item do catálogo,
      tudo na mesma tela de criação
- [x] OS nasce com status "Aguardando aprovação" (`quoted`)
- [x] Aprovar orçamento → status "Aprovada" (`approved`), timestamp gravado
- [x] Iniciar serviço (sem prazo) → status "Em execução" (`in_progress`),
      timestamp gravado
- [x] Concluir serviço → status "Concluída" (`completed`), timestamp gravado
- [x] Marcar para emissão de NF → flag `invoiceRequested` setada, OS some
      da ação mas continua com status `completed`

### ✅ Emissão de NF (modo teste)
- [x] OS flegada aparece na fila "Aguardando emissão" em `/invoices`
- [x] Selecionar + "Emitir selecionadas" → gera documento de teste,
      grava em `clients/{clientId}/invoices`, OS muda para `invoiced`
- [x] Nota aparece na lista "Emitidas" com número, tipo (NFSE/NFE), valor
- [x] Botão "Ver documento" baixa um `.html` com o conteúdo da nota de teste
- [x] Página de detalhe da OS reflete "NF emitida — ver documento" após
      a emissão

### ✅ Dashboard
- [x] Cartões refletem corretamente: OS criada hoje conta em "OS hoje" e
      no "Faturamento do mês"
- [x] Lista de OS recentes aparece e linka para o detalhe

### ✅ Relatórios
- [x] Sem filtro de data: mostra todas as OS, total e valor corretos
- [x] Agrupamento "Por tipo de veículo" soma corretamente
- [x] Exportar CSV gera arquivo com acentuação correta (BOM UTF-8)

### ✅ Melhorias (feedback)
- [x] Botão flutuante aparece em toda tela logada
- [x] Enviar sugestão grava com página de origem e e-mail do usuário
- [x] Tela `/feedback` lista, permite mudar status, exporta JSON

### ✅ Regras de segurança do Firestore
- [x] Regras publicadas em produção (não é só arquivo local) — usuário só
      lê/escreve dentro do próprio `clients/{seu-uid}`
- [x] Confirmado: sem as regras corretas, toda escrita falha com
      `permission-denied` (isso realmente aconteceu durante o
      desenvolvimento e foi corrigido — ver `CLAUDE.md` para o que
      aprendemos)

## Não testado / gaps conhecidos

- ❌ Múltiplos usuários simultâneos na mesma oficina (não é suportado
  ainda, ver `CLAUDE.md` seção 3)
- ❌ Comportamento com grande volume de dados (centenas/milhares de OS) —
  listas não são paginadas
- ❌ Mobile (app Expo não tem telas implementadas)
- ❌ Deploy em produção (Hostinger) — só testado em `localhost:3000`
- ❌ Edição/exclusão de clientes, veículos, serviços (não implementado)
- ❌ Emissão de NF real (provedor mock só gera documento de teste)
- ❌ Responsividade em telas muito pequenas além do ajuste de tabelas
  (`overflow-x-auto`) — não foi feito um passe completo de mobile-first

## Como re-testar do zero

```bash
cd frontend-web && npm run dev
```

Acesse `http://localhost:3000`, cadastre uma conta nova (ou reuse
`teste@mecos.com` se ainda existir no Firebase Auth do projeto), e siga a
checklist acima em ordem — o fluxo de OS depende de já ter cliente,
veículo e serviço cadastrados (ou pode criá-los inline na própria tela de
Nova OS).
