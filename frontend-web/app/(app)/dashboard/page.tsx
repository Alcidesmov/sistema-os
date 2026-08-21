import { redirect } from 'next/navigation'

/**
 * O antigo dashboard virou a esteira (/esteira). Este arquivo continua
 * existindo de propósito: o login faz router.push('/dashboard') e o dono
 * tem o atalho salvo — apagar a rota quebraria os dois.
 */
export default function DashboardPage() {
  redirect('/esteira')
}
