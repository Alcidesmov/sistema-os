# Roadmap — MecOS

Fases do projeto com escopo e critério de "pronto" para cada uma. Ver
`CLAUDE.md` seção 9 (Histórico de Versões) para o changelog resumido de
cada versão já entregue.

---

## ✅ Fase 1 — Setup & Auth (concluída)

**Escopo:** estrutura do monorepo, Firebase (Firestore + Auth) configurado
e publicado, autenticação funcionando.

**Critério de pronto:** ✅ atingido — login/cadastro funcionam, bootstrap
automático de oficina, regras de segurança do Firestore publicadas em
produção.

## ✅ Fase 2 — CRUD de OS + Workflow (concluída)

**Escopo:** cadastro de clientes/veículos/serviços, criação rápida de OS,
workflow orçamento→aprovação→execução→conclusão, dashboard, relatórios,
sistema de sugestões.

**Critério de pronto:** ✅ atingido e testado ao vivo — ver `docs/TESTES.md`
para a checklist completa.

## 🔶 Fase 3 — Integração real de NF (em andamento)

**Escopo:**
1. Decidir o provedor definitivo (Nota Gateway/ex-eNotas, ou outro — ver
   `docs/ENOTA-API.md` para a pesquisa técnica já feita)
2. Fluxo de onboarding: cada oficina cadastra CNPJ, regime tributário,
   inscrições, e certificado digital A1 (via nossa API, chamando
   `POST /v1/empresas` + `POST /v1/empresas/{id}/certificadoDigital` do
   provedor — endpoints já confirmados)
3. Implementar `lib/invoices/{provider}Provider.ts` real, implementando a
   interface `InvoiceProvider` já existente — **trocar só o export em
   `lib/invoices/provider.ts`**, nada mais deve mudar
4. Firebase Function de webhook para receber status assíncrono de emissão
5. Tratamento de erro por código (ver tabela em `docs/ENOTA-API.md` seção 7)

**Critério de pronto:** uma OS real emite NF-e e/ou NFS-e de verdade,
número/XML/PDF são armazenados e visíveis na tela `/invoices`, status
assíncrono chega via webhook e atualiza a OS automaticamente.

**Bloqueadores conhecidos:** vários detalhes do schema completo de emissão
ainda não confirmados na doc pública do provedor — ver "GAPS" em
`docs/ENOTA-API.md` seção 9. Alguns exigem contato direto com o suporte
do provedor escolhido.

## ⬜ Fase 4 — Contabilidade (não iniciada)

**Escopo:** geração automática de XMLs para NF de comércio (produtos) e
arquivos de NF de serviço, para a contabilidade baixar/consumir.

**Depende de:** Fase 3 concluída (não faz sentido gerar XML de nota que
não existe de verdade ainda).

**Critério de pronto:** contador consegue baixar, num único lugar, todos
os XMLs/arquivos de NF de um período, sem precisar pedir manualmente pro
dono de cada oficina.

## 🔶 Fase 5 — Sistema de Melhorias (concluída na essência)

O pedido original ("melhorias sugeridas na tela, cai num JSON pra
análise") **já está implementado** — módulo "Melhorias", ver
`docs/MODULOS.md` seção 9. Não marcado como 100% fechado porque pode
crescer (ex.: votação, priorização) conforme uso real trouxer sinal do
que falta.

---

## Não-fases (pendências técnicas sem fase definida)

Essas não fazem parte do pedido original do produto, mas são dívidas
técnicas conhecidas — endereçar quando o volume de uso justificar:

- **Deploy real no Hostinger** — hoje só roda em `localhost`. Existe
  workflow do GitHub Actions preparado
  (`.github/workflows/deploy.yml`) mas incompleto.
- **App Mobile (Expo)** — estrutura existe, nenhuma tela implementada.
- **Edição/exclusão** de clientes, veículos, serviços — hoje só
  criar+listar.
- **Testes automatizados** — hoje 100% manual, ver `docs/TESTES.md`.
- **Multi-usuário por oficina** — hoje `clientId === uid`, um único login
  por oficina (ver `CLAUDE.md` seção 3).
- **Paginação** — listas carregam tudo de uma vez; ok para o volume do
  MVP, revisar se alguma oficina crescer muito.
