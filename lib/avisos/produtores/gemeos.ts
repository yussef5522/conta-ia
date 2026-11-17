// ⭐ (16/11/2026) O PRODUTOR DA FILA DE GÊMEOS — roda com os outros (scripts/cron-judge.ts). Um aviso por
// empresa com a contagem de pares parecidos ainda sem resposta do dono; fila vazia cala. Só lê e avisa.
import { prisma } from '@/lib/db'
import { avisarFilaDeGemeos } from '@/lib/stock/itens/fila-de-gemeos'

export async function produzirAvisosDeGemeos(companyId: string): Promise<{ abertos: number }> {
  return { abertos: await avisarFilaDeGemeos(companyId, prisma) }
}
