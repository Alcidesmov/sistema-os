import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import cors from 'cors'
import * as nodemailer from 'nodemailer'

admin.initializeApp()

const corsHandler = cors({ origin: true })
const db = admin.firestore()

// Placeholder function
export const helloWorld = functions.https.onRequest((req, res) => {
  corsHandler(req, res, () => {
    res.json({ message: 'Sistema de OS - Firebase Functions' })
  })
})

// TODO: Functions para eNota, relatórios, etc.

/**
 * Aviso de retorno por e-mail (v0.6.0) — PRIMEIRA VERSÃO, envia via Gmail
 * SMTP (Nodemailer) com uma conta/senha de app do Google. É
 * DELIBERADAMENTE o caminho mais simples para o teste inicial pedido pelo
 * Alcides ("vamos fazer o teste com 35alcides") — o passo seguinte,
 * quando cada oficina-cliente tiver a própria conta Google conectada, é
 * trocar isso pela Gmail API com OAuth por tenant (mais setup, mais
 * correto pra multi-tenant real). Ver CLAUDE.md seção sobre este recurso
 * para o runbook de configuração e deploy — NADA disso foi testado em
 * produção ainda porque este ambiente de desenvolvimento não tem
 * `firebase-tools` autenticado pra fazer o deploy.
 *
 * Config necessária (firebase functions:config:set):
 *   gmail.user   — conta Gmail que vai ENVIAR (com senha de app, não a
 *                  senha normal — precisa 2FA ativo na conta Google)
 *   gmail.pass   — a senha de app de 16 caracteres
 *   aviso.test_override — (opcional, usado enquanto testamos) um e-mail
 *                  fixo que recebe TODOS os avisos no lugar do cliente
 *                  real, ex: "35alcides@gmail.com". Remover essa chave
 *                  quando for hora de enviar pro cliente de verdade.
 */
export const enviarAvisoRetorno = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Faça login para enviar o aviso.')
    }

    const { clientId, orderId } = data as { clientId?: string; orderId?: string }
    if (!clientId || !orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'clientId e orderId são obrigatórios.')
    }

    // Mesma verificação de posse que a regra do Firestore faz (isMember):
    // o uid autenticado precisa pertencer a ESTA oficina.
    const lookupSnap = await db.doc(`users/${context.auth.uid}`).get()
    const lookup = lookupSnap.data() as { clientId?: string } | undefined
    if (!lookup || lookup.clientId !== clientId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Você não pertence a esta oficina.'
      )
    }

    const orderSnap = await db.doc(`clients/${clientId}/orders/${orderId}`).get()
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'O.S. não encontrada.')
    }
    const order = orderSnap.data() as admin.firestore.DocumentData

    if (order.entryKm == null) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Esta O.S. ainda não tem km de entrada registrado.'
      )
    }

    const customerSnap = await db.doc(`clients/${clientId}/customers/${order.customerId}`).get()
    const customer = customerSnap.data() as { email?: string; name?: string } | undefined

    const clientSnap = await db.doc(`clients/${clientId}`).get()
    const client = clientSnap.data() as
      | { name?: string; nomeFantasia?: string; phone?: string }
      | undefined
    const oficinaNome = client?.nomeFantasia || client?.name || 'Sua oficina'

    const testOverride = functions.config().aviso?.test_override as string | undefined
    const destinatario = testOverride || customer?.email
    if (!destinatario) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Este cliente não tem e-mail cadastrado.'
      )
    }

    const interval = (order.reminderKmInterval as number) ?? 3000
    const targetKm = (order.entryKm as number) + interval

    const gmailUser = functions.config().gmail?.user as string | undefined
    const gmailPass = functions.config().gmail?.pass as string | undefined
    if (!gmailUser || !gmailPass) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'E-mail de envio não configurado (gmail.user/gmail.pass). Ver CLAUDE.md.'
      )
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    const veiculo = [order.vehiclePlate, order.vehicleModel].filter(Boolean).join(' · ') || 'seu veículo'
    const avisoParaClienteReal = testOverride
      ? `<p style="color:#b45309;font-size:12px">[TESTE — este e-mail seria enviado para ${
          customer?.email ?? 'o cliente (sem e-mail cadastrado)'
        }]</p>`
      : ''

    const html = `
      <div style="font-family:sans-serif;font-size:14px;color:#111">
        ${avisoParaClienteReal}
        <p>Olá, ${order.customerName || customer?.name || ''}!</p>
        <p>
          Aqui é a <strong>${oficinaNome}</strong>. Registramos que ${veiculo} entrou na oficina
          com <strong>${Number(order.entryKm).toLocaleString('pt-BR')} km</strong>.
        </p>
        <p>
          Recomendamos o retorno para revisão por volta dos
          <strong>${targetKm.toLocaleString('pt-BR')} km</strong>
          (a cada ${interval.toLocaleString('pt-BR')} km).
        </p>
        <p>Qualquer dúvida, estamos à disposição.</p>
        <p style="color:#666;font-size:12px">${oficinaNome}${client?.phone ? ` · ${client.phone}` : ''}</p>
      </div>
    `

    await transporter.sendMail({
      from: `"${oficinaNome}" <${gmailUser}>`,
      to: destinatario,
      subject: `Aviso de retorno — ${veiculo}`,
      html,
    })

    await db.collection(`clients/${clientId}/orders/${orderId}/history`).add({
      at: Date.now(),
      by: context.auth.token.email || context.auth.uid,
      action: 'aviso de retorno enviado por e-mail',
      detail: testOverride ? `modo teste → ${testOverride}` : destinatario,
    })

    return { ok: true, sentTo: destinatario, testMode: Boolean(testOverride) }
  })
