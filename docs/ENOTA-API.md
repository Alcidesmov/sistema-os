# Integração eNota API

## Documentação Oficial

https://atendimento.enotas.com.br/hc/pt-br/sections/35742517117709-Funcionalidades-da-API

## Endpoints Principais

### Emitir NF
```
POST /api/nfe
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "naturezaOperacao": "Prestação de Serviço",
  "items": [...],
  "totalValue": 1000.00
}
```

### Consultar Status
```
GET /api/nfe/{transactionId}
Authorization: Bearer {TOKEN}
```

## Fluxo de Integração

1. Firebase Function recebe requisição de emissão de NF
2. Formata dados da OS para eNota
3. Faz POST em /api/nfe
4. Recebe transactionId
5. Salva em Firestore com status "pending"
6. eNota emite NF e envia webhook
7. Webhook atualiza status para "emitted"

## Webhook Setup

URL: `https://seu-firebasefunction.cloudfunctions.net/enotaWebhook`
Eventos: `nfe.emitted`, `nfe.rejected`
