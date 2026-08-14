# MecOS — Sistema de Ordem de Serviço para Oficinas Mecânicas

Sistema multi-tenant de gestão de Ordens de Serviço (OS) para oficinas
mecânicas: cadastro de clientes/veículos, orçamento, aprovação, execução
com prazo, conclusão e emissão de NF em lote.

> 🤖 Se você é o Claude Code (ou outra IA) entrando neste projeto pela
> primeira vez: leia [`CLAUDE.md`](CLAUDE.md) primeiro — é a fonte de
> verdade sobre arquitetura, módulos e convenções.

## Estrutura do Projeto

```
sistema-os/
├── frontend-web/      # Next.js 14 (App Router) — a aplicação real, roda em localhost:3000
├── mobile/             # React Native/Expo — só scaffold, telas não implementadas
├── firebase/           # Firestore rules + Cloud Functions (placeholder, nada em uso ainda)
├── docs/                # Documentação técnica detalhada (ver abaixo)
└── CLAUDE.md            # Contexto para Claude Code — visão geral, módulos, convenções
```

## Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | Firebase (Firestore + Authentication) |
| Banco de dados | Cloud Firestore, região `southamerica-east1` (São Paulo) |
| Emissão de NF | Camada própria `InvoiceProvider` (hoje: provedor mock/teste — ver [`docs/ENOTA-API.md`](docs/ENOTA-API.md)) |
| Hospedagem alvo | Hostinger (frontend) — ainda não publicado |
| Repositório | [github.com/Alcidesmov/sistema-os](https://github.com/Alcidesmov/sistema-os) |

Mobile (Expo) e Cloud Functions estão scaffolded mas sem funcionalidade
real ainda — ver roadmap em `CLAUDE.md`.

## Quick Start

### Jeito rápido (Alcides): duplo clique

Dê duplo clique em [`INICIAR_MECOS.command`](INICIAR_MECOS.command), na raiz
do projeto. Ele instala as dependências na primeira vez, sobe o servidor e
abre `http://localhost:3000` sozinho. Para encerrar, feche a janela do
Terminal ou `Ctrl+C`.

### Manual (linha de comando)

### 1. Instalar dependências

```bash
cd frontend-web && npm install
```

### 2. Configurar Firebase

Crie `frontend-web/.env.local` com as credenciais do projeto Firebase
(`sistema-os-ef1ef`). Ver [`docs/FIREBASE-SETUP.md`](docs/FIREBASE-SETUP.md)
para o passo a passo e o formato exato do arquivo.

### 3. Rodar em desenvolvimento

```bash
cd frontend-web && npm run dev
```

Acesse `http://localhost:3000` — a primeira conta criada (tela de
cadastro) já bootstrapa automaticamente uma oficina nova.

## Funcionalidades Implementadas

- ✅ Autenticação (login/cadastro) com bootstrap automático de oficina
- ✅ Cadastro de clientes, veículos e catálogo de serviços/peças
- ✅ Criação rápida de OS (cliente + veículo novos ou existentes numa única tela)
- ✅ Workflow completo: orçamento → aprovação → execução (com prazo) → conclusão
- ✅ Emissão de NF em lote — hoje em **modo de teste** (documento mock, sem valor fiscal), pronto para conectar um provedor real
- ✅ Dashboard com estatísticas em tempo real
- ✅ Relatórios com filtro por período, totais por tipo de veículo, exportação CSV
- ✅ Sistema de sugestões de melhoria (botão flutuante em toda tela), com exportação JSON

Ver detalhamento completo de cada módulo em [`docs/MODULOS.md`](docs/MODULOS.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Visão geral, arquitetura, módulos, convenções — contexto para trabalhar no projeto com IA |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Estrutura de dados no Firestore e fluxo geral |
| [`docs/MODULOS.md`](docs/MODULOS.md) | Detalhamento funcional de cada tela/módulo — campos, regras, comportamento |
| [`docs/GUIA-VISUAL.md`](docs/GUIA-VISUAL.md) | Padrão visual (cores, componentes, espaçamento) usado nas telas |
| [`docs/TESTES.md`](docs/TESTES.md) | O que foi testado manualmente e confirmado funcionando |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fases do projeto, o que falta, critérios de conclusão |
| [`docs/FIREBASE-SETUP.md`](docs/FIREBASE-SETUP.md) | Como configurar um projeto Firebase do zero |
| [`docs/ENOTA-API.md`](docs/ENOTA-API.md) | Pesquisa técnica da API eNotas/Nota Gateway para a integração real de NF |

## Contato

Alcides — 35alcides@gmail.com
