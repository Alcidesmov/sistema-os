# Setup de Envio de E-mail na VPS (v0.6.1)

Este documento descreve como ativar o botão "📧 Enviar aviso de retorno" na VPS Hostinger.

## O que foi feito

A partir da v0.6.1, o envio de e-mail deixou de usar **Cloud Functions do Firebase** (que requer plano Blaze pago) e passou a usar um **endpoint Node.js/Express** rodando na própria VPS onde o MecOS já está em produção.

**Novos arquivos:**
- `frontend-web/app/api/send-return-reminder/route.ts` — endpoint que recebe requisição de envio
- `frontend-web/lib/firebase/email.ts` — função auxiliar no cliente
- `frontend-web/components/orders/KmDaOS.tsx` — atualizado pra chamar o endpoint

**Dependências adicionadas:**
- `nodemailer` — envio SMTP pra Gmail
- `firebase-admin` — validação de tokens do lado do servidor

## Passos para ativar

### 1. Gerar senha de app do Google

Acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) com a conta `35alcides@gmail.com`:

1. **Certifique-se de que a verificação em duas etapas está ativa** — é obrigatório pra gerar senha de app.
2. Selecione **Mail** como app e **Windows Computer** (ou qualquer device) como dispositivo.
3. Clique em **Generate** — Google vai gerar uma senha de 16 caracteres.
4. **Guarde essa senha** — você vai precisar dela no próximo passo.

### 2. Adicionar variáveis de ambiente na VPS

Na VPS Hostinger, edite o arquivo `.env.production.local` (ou crie se não existir) com as credenciais:

```bash
ssh seu_usuario@seu_ip_hostinger
cd /home/mecos/sistema-os

# Adicione ou edite .env.production.local
nano .env.production.local
```

Adicione (ou atualize) as linhas:

```env
GMAIL_USER=35alcides@gmail.com
GMAIL_PASS=SENHA_DE_APP_16_CARACTERES
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"sistema-os-ef1ef",...}
```

**Sobre `FIREBASE_SERVICE_ACCOUNT_KEY`:** você precisa da chave de serviço do Firebase. No console do Firebase (`console.firebase.google.com`, projeto `sistema-os-ef1ef`), vá em:
- Configurações do projeto → Contas de serviço → clique em **Gerar nova chave privada**
- Salve o JSON que é baixado
- Cole o conteúdo JSON completo como valor de `FIREBASE_SERVICE_ACCOUNT_KEY` no `.env.production.local`

### 3. Deploy do código novo

O workflow do GitHub Actions já faz deploy automático quando você der `git push` pra `main`. Se você preferir fazer manualmente na VPS:

```bash
cd /home/mecos/sistema-os
git pull origin main
npm install  # instala nodemailer e firebase-admin
npm run build
pm2 restart mecos
```

### 4. Testar

Para testar sem enviar um e-mail de verdade:

1. Crie um cliente na conta RRadiadores com e-mail `35alcides@gmail.com`.
2. Crie uma O.S. com esse cliente.
3. Vincule um veículo à O.S.
4. Registre o km de entrada.
5. Clique no botão "📧 Enviar aviso de retorno".
6. Verifique se o e-mail chegou em `35alcides@gmail.com`.

Se tudo correr bem, o e-mail deve chegar em menos de 1 segundo.

## Próximas melhorias

- **Gmail API com OAuth por oficina:** pra quando houver múltiplas oficinas-cliente, usar a conta Google de cada uma delas pra envio de e-mail (em vez da conta centralizando `35alcides@gmail.com`).
- **Monitoramento agendado:** um agendador que avisar proativamente, sem esperar o cliente voltar (requer Cloud Scheduler ou similar).

## Troubleshooting

**Erro: "GMAIL_USER ou GMAIL_PASS não configurados"**
→ Verifique se as variáveis estão definidas em `.env.production.local` na VPS.

**Erro: "Falha ao validar token Firebase"**
→ Certifique-se de que `FIREBASE_SERVICE_ACCOUNT_KEY` está correto e completo.

**Erro: "Cliente não tem e-mail cadastrado"**
→ Adicione um e-mail ao cliente na tela de edição (Clientes → {cliente} → e-mail).

**E-mail não chega**
→ Verifique se a senha de app foi gerada corretamente e não foi alterada.
   Também confirme que nenhum antivírus ou firewall está bloqueando SMTP.
