# Setup Firebase

## Pré-requisitos

1. Conta Google
2. Firebase CLI instalado: `npm install -g firebase-tools`

## Passo a Passo

1. Criar projeto no Firebase Console
2. Ativar Firestore Database (modo produção)
3. Ativar Firebase Auth (Email/Senha)
4. Criar app web e copiar config
5. Criar arquivo `.env.local` com as credenciais

## Variáveis de Ambiente

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Firestore Rules

Ver `firebase/firestore.rules`

## Cloud Functions

Deploy:
```bash
cd firebase
npm run build
npm run deploy
```
