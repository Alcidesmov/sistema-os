import { Order, Client } from '@/lib/types'
import { InvoiceProvider, InvoiceEmissionResult } from '@/lib/invoices/provider'
import { money, vehicleLabel, orderLabel } from '@/lib/orders/format'

/** O documento é HTML montado por interpolação — nome de cliente com `&`
 *  ou `<` quebrava a página inteira. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTestDocument(order: Order, client: Client, number: string): string {
  const itemsHtml = (order.items ?? [])
    .map(
      (i) =>
        `<tr><td>${esc(i.quantity)}x ${esc(i.description)}</td><td style="text-align:right">${money(
          i.subtotal
        )}</td></tr>`
    )
    .join('')

  /**
   * Veículo é OPCIONAL desde a v0.5.0. Quando não existe, o bloco INTEIRO
   * sai do documento — a versão anterior interpolava os campos direto e
   * imprimia "Veículo: undefined · undefined" na nota. vehicleLabel com
   * fallback vazio também cobre a O.S. legada que tem placa gravada mas
   * não tem vehicleId.
   */
  const veiculo = vehicleLabel(order, '')
  const veiculoHtml = veiculo ? `<p class="muted">Veículo: ${esc(veiculo)}</p>` : ''

  const emitente = [
    esc(client.nomeFantasia || client.name),
    client.cnpj ? `CNPJ ${esc(client.cnpj)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>NF de Teste ${esc(number)}</title>
<style>
  body { font-family: -apple-system, sans-serif; padding: 32px; color: #111; }
  .watermark { color: #b45309; background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-weight: 600; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .muted { color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
  .total { font-weight: 700; font-size: 16px; }
</style>
</head>
<body>
  <div class="watermark">⚠ DOCUMENTO DE TESTE — SEM VALOR FISCAL. Gerado pelo provedor mock enquanto a integração real (eNotas ou outro) não é configurada.</div>
  <h1>Nota Fiscal de Teste ${esc(number)}</h1>
  <p class="muted">Emitente: ${emitente}</p>
  <p class="muted">O.S. ${esc(orderLabel(order))}</p>
  <p class="muted">Cliente: ${esc(order.customerName)}</p>
  ${veiculoHtml}
  <p class="muted">Emitida em: ${esc(new Date().toLocaleString('pt-BR'))}</p>
  <table>
    ${itemsHtml}
    <tr><td class="total">Total</td><td class="total" style="text-align:right">${money(order.totalValue)}</td></tr>
  </table>
</body>
</html>`
}

export const mockInvoiceProvider: InvoiceProvider = {
  name: 'mock',
  async emit(order: Order, client: Client): Promise<InvoiceEmissionResult> {
    const number = `TESTE-${Date.now()}`
    return {
      provider: 'mock',
      kind: (order.items ?? []).some((i) => i.type === 'part') ? 'nfe' : 'nfse',
      number,
      totalValue: order.totalValue,
      documentContent: buildTestDocument(order, client, number),
    }
  },
}
