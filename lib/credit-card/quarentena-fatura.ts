// ⭐⭐⭐ A QUARENTENA — toda fatura fica guardada com o texto extraído (16/09/2026).
//
// **A régua do dono:** *"fatura recusada fica guardada com o texto extraído pra eu/você
// diagnosticar sem pedir o PDF de novo"* + *"PASSA A GUARDAR o arquivo de cada import — o
// golden de amanhã"*.
//
// ⛔⛔ **MEDIDO HOJE:** o import de fatura **não guardava nada**. A fatura que a conferência
// recusou **se perdeu**, e diagnosticá-la exigia pedir o PDF de volta ao dono. É o que o
// `rawOfxBlob` resolveu pro extrato em 13/08 — e que nunca chegou aqui.
//
// ⭐ **GUARDA TODA TENTATIVA, não só a recusada.** A que deu certo é o **golden de amanhã**:
// foi por não ter os PDFs antigos que o congelador nasceu com 9 fixtures em vez de com o
// histórico inteiro.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export interface EntradaDaQuarentena {
  companyId?: string | null
  profileId?: string | null
  cardId: string
  banco: string
  desfecho: 'OK' | 'RECUSADA'
  motivo?: string | null
  declarado?: number | null
  calculado?: number | null
  texto: string
  linhas?: number
  criadoPorId?: string | null
}

/**
 * ⚠️ **FAIL-SOFT POR CONSTRUÇÃO.** Guardar é diagnóstico, não o trabalho: se a gravação
 * falhar, o import **segue**. Derrubar um import legítimo porque a quarentena não gravou
 * seria trocar um problema de diagnóstico por um de operação.
 */
export async function guardarNaQuarentena(
  e: EntradaDaQuarentena, db: PrismaClient = defaultPrisma,
): Promise<string | null> {
  try {
    const r = await db.faturaQuarentena.create({
      data: {
        companyId: e.companyId ?? null, profileId: e.profileId ?? null,
        cardId: e.cardId, banco: e.banco, desfecho: e.desfecho,
        motivo: e.motivo ?? null, declarado: e.declarado ?? null, calculado: e.calculado ?? null,
        texto: e.texto, linhas: e.linhas ?? 0, criadoPorId: e.criadoPorId ?? null,
      },
      select: { id: true },
    })
    return r.id
  } catch {
    return null
  }
}

/**
 * ⭐ AS RECUSADAS ESPERANDO DIAGNÓSTICO — é o que eu (ou o dono) abre pra investigar sem
 * pedir o PDF de novo.
 */
export async function recusadasParaDiagnosticar(
  o: { companyId?: string; profileId?: string }, db: PrismaClient = defaultPrisma,
) {
  return db.faturaQuarentena.findMany({
    where: {
      desfecho: 'RECUSADA', textoPurgadoEm: null,
      ...(o.companyId ? { companyId: o.companyId } : {}),
      ...(o.profileId ? { profileId: o.profileId } : {}),
    },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, banco: true, motivo: true, declarado: true, calculado: true, linhas: true, criadoEm: true },
    take: 50,
  })
}

/**
 * ⚠️ O EXPURGO (LGPD) — o texto tem nome de estabelecimento e 4 dígitos de cartão. **Mesma
 * régua do `rawOfxBlob`: 12 meses**, e a metadata FICA (auditoria sem PII).
 */
export async function expurgarTextosAntigos(
  agora: Date, db: PrismaClient = defaultPrisma,
): Promise<number> {
  const limite = new Date(agora.getTime() - 365 * 24 * 60 * 60 * 1000)
  const r = await db.faturaQuarentena.updateMany({
    where: { criadoEm: { lt: limite }, textoPurgadoEm: null },
    data: { texto: '', textoPurgadoEm: agora },
  })
  return r.count
}
