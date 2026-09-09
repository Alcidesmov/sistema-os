import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Inicializa Firebase Admin se ainda não inicializado
if (!getApps().length) {
  // Em produção (Hostinger), as credenciais devem estar em variáveis de ambiente
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')
  initializeApp({
    credential: cert(serviceAccount),
  })
}

const db = getFirestore()
const auth = getAuth()

// Configurar Nodemailer com Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
})

export async function POST(req: NextRequest) {
  try {
    const { orderId, clientId } = await req.json()

    if (!orderId || !clientId) {
      return NextResponse.json(
        { error: 'orderId e clientId são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar Firebase Token do header Authorization
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
    let decodedToken
    try {
      decodedToken = await auth.verifyIdToken(token)
    } catch (err) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

    // Verificar se o usuário pertence ao clientId
    const userDoc = await db.collection('users').doc(decodedToken.uid).get()
    if (!userDoc.exists || userDoc.data()?.clientId !== clientId) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Ler a Ordem de Serviço
    const orderDoc = await db
      .collection('clients')
      .doc(clientId)
      .collection('orders')
      .doc(orderId)
      .get()

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: 'Ordem de Serviço não encontrada' },
        { status: 404 }
      )
    }

    const order = orderDoc.data() as any
    if (!order.customerId) {
      return NextResponse.json(
        { error: 'Ordem sem cliente associado' },
        { status: 400 }
      )
    }

    // Ler o Cliente
    const customerDoc = await db
      .collection('clients')
      .doc(clientId)
      .collection('customers')
      .doc(order.customerId)
      .get()

    if (!customerDoc.exists || !customerDoc.data()?.email) {
      return NextResponse.json(
        { error: 'Cliente não tem e-mail cadastrado' },
        { status: 400 }
      )
    }

    const customer = customerDoc.data() as any

    // Ler o Veículo (se houver)
    let vehicleInfo = ''
    if (order.vehicleId) {
      const vehicleDoc = await db
        .collection('clients')
        .doc(clientId)
        .collection('vehicles')
        .doc(order.vehicleId)
        .get()

      if (vehicleDoc.exists) {
        const vehicle = vehicleDoc.data() as any
        vehicleInfo = `${vehicle.brand} ${vehicle.model} (${vehicle.plate})`
      }
    }

    // Calcular km-alvo (assumindo 3000 km se não fornecido)
    const reminderKmInterval = order.reminderKmInterval || 3000
    const kmAlvo = (order.entryKm || 0) + reminderKmInterval

    // Montar e-mail
    const html = `
      <h2>Aviso de Retorno - MecOS</h2>
      <p>Olá <strong>${customer.name}</strong>,</p>
      <p>Este é um lembrete automático de que seu veículo pode estar próximo do km recomendado para retorno na oficina.</p>

      <h3>Detalhes do Veículo</h3>
      <ul>
        <li><strong>Veículo:</strong> ${vehicleInfo || 'Não informado'}</li>
        <li><strong>Km de entrada:</strong> ${order.entryKm || '—'}</li>
        <li><strong>Km recomendado para retorno:</strong> ${kmAlvo}</li>
        <li><strong>Ordem de Serviço #${order.orderNumber || 'sem número'}</strong></li>
      </ul>

      <p>Recomendamos agendar um atendimento para evitar problemas maiores.</p>

      <p><em>Att,<br>MecOS - Sistema de Oficina</em></p>
    `

    // Enviar e-mail
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: customer.email,
      subject: `[MecOS] Aviso de Retorno - ${vehicleInfo || 'Seu Veículo'}`,
      html,
    })

    return NextResponse.json({
      success: true,
      message: `E-mail enviado para ${customer.email}`,
    })
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error)
    return NextResponse.json(
      { error: 'Erro ao enviar e-mail' },
      { status: 500 }
    )
  }
}
