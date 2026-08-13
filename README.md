# Sistema de Ordem de Serviço (OS) para Oficinas Mecânicas

Sistema completo de gerenciamento de ordens de serviço com integração de NF-e via eNota.

## Estrutura do Projeto

```
sistema-os/
├── frontend-web/      # Next.js web app (Hostinger)
├── mobile/            # React Native/Expo app
├── firebase/          # Cloud Functions e configurações Firebase
└── docs/              # Documentação
```

## Stack Tecnológico

- **Frontend Web:** Next.js 14 + TypeScript + Shadcn/ui
- **Mobile:** React Native + Expo
- **Backend:** Firebase (Firestore + Auth + Functions)
- **Integração NF-e:** eNota API
- **Hospedagem:** Hostinger (frontend) + Firebase (backend)
- **Versionamento:** GitHub

## Quick Start

### 1. Setup Initial

```bash
cd frontend-web && npm install
cd ../mobile && npm install
cd ../firebase && npm install
```

### 2. Firebase Setup

```bash
# Criar arquivo .env.local com credenciais Firebase
# Ver docs/FIREBASE-SETUP.md
```

### 3. Desenvolvimento

```bash
# Terminal 1: Frontend
cd frontend-web && npm run dev

# Terminal 2: Mobile
cd mobile && npm start

# Terminal 3: Firebase emulator (opcional)
cd firebase && npm run emulate
```

## Fases de Implementação

- [x] Fase 1: Setup & Auth (em progresso)
- [ ] Fase 2: CRUD de OS
- [ ] Fase 3: Integração eNota
- [ ] Fase 4: Relatórios
- [ ] Fase 5: Sistema de Melhorias

## Documentação

- [Plano Completo](docs/PLANO.md)
- [Arquitetura Firestore](docs/ARQUITETURA.md)
- [Setup Firebase](docs/FIREBASE-SETUP.md)
- [Integração eNota](docs/ENOTA-API.md)

## Contato

Alcides - 35alcides@gmail.com
