# Arquitetura do Sistema de OS

## Estrutura Firestore

```
firestore/
├── clients/{clientId}
│   ├── info: { nome, CNPJ, email, telefone }
│   ├── vehicles/{vehicleId}: { placa, modelo, ano, cor }
│   ├── services/{serviceId}: { nome, preco, descricao }
│   ├── orders/{orderId}: { status, items, quote, execution, invoice }
│   ├── invoices/{invoiceId}: { nfeNumber, status, enotaData }
│   ├── feedback/{feedbackId}: { message, votingScore, timestamp }
│   └── users/{userId}: { email, nome, role }
│
├── enotaWebhooks: { timestamp, orderId, status }
├── systemConfig: { apiKeys, settings }
└── auditLog: { userId, action, timestamp, data }
```

## Fluxo de Dados

1. **Cadastro de OS**: Cliente preenche formulário → Salva em `orders`
2. **Orçamento**: Adiciona itens → Calcula total
3. **Aprovação**: Cliente aprova → Status muda para `approved`
4. **Execução**: Técnico marca como iniciada
5. **Fechamento**: Finaliza → Opção de emitir NF
6. **Emissão NF**: Firebase Function → Chama eNota API
7. **Webhook**: eNota notifica → Atualiza status em Firestore

## Segurança

- Firestore Rules: Isolamento por clientId
- Firebase Auth: Email/Senha + 2FA (opcional)
- LGPD: Dados criptografados
- Audit Log: Todas as ações críticas
