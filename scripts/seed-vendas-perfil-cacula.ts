// VENDAS FASE 1 (17/08/2026) — seed do PerfilRecebimento da Cacula (as respostas
// do onboarding que o dono confirmou). IDEMPOTENTE: rodar 2× = 0 mudança. Usa o
// builder único (lib/vendas/seed-cacula.ts) pra não divergir do teste. Aditivo
// (só cria linhas em tabelas novas; não toca dado existente).
//
// Uso: npx tsx scripts/seed-vendas-perfil-cacula.ts

import { PrismaClient } from '@prisma/client'
import { buildCaculaDefaultRegras, CACULA_IDS } from '../lib/vendas/seed-cacula'

const prisma = new PrismaClient()
const CACULA_COMPANY = 'cmq17yapb00gnrndlh33sctbo'

async function main() {
  // 1. Perfil (1 por empresa). upsert idempotente.
  const perfil = await prisma.perfilRecebimento.upsert({
    where: { companyId: CACULA_COMPANY },
    update: {},
    create: { companyId: CACULA_COMPANY, semanaComecaEm: 'SEG' },
  })
  console.log(`perfil: ${perfil.id} (semana começa ${perfil.semanaComecaEm})`)

  // 2. Regras. Idempotente por (companyId, bankAccountId, meio, vigenteDe).
  const regras = buildCaculaDefaultRegras(CACULA_IDS)
  let criadas = 0
  for (const r of regras) {
    const existe = await prisma.regraRecebimento.findFirst({
      where: {
        companyId: CACULA_COMPANY,
        bankAccountId: r.bankAccountId,
        meio: r.meio,
        vigenteDe: r.vigenteDe,
      },
    })
    if (existe) {
      // Corrige DRIFT: se a regra existe mas os campos divergem do builder
      // (ex: cofre recebeSabDom false→true, correção 17/08), ATUALIZA.
      const precisaUpdate =
        existe.diasUteisAtraso !== r.diasUteisAtraso ||
        existe.recebeSabDom !== r.recebeSabDom ||
        existe.origemHint !== r.origemHint ||
        existe.confirmadoPeloDono !== (r.confirmadoPeloDono ?? true)
      if (precisaUpdate) {
        await prisma.regraRecebimento.update({
          where: { id: existe.id },
          data: {
            diasUteisAtraso: r.diasUteisAtraso,
            recebeSabDom: r.recebeSabDom,
            origemHint: r.origemHint,
            confirmadoPeloDono: r.confirmadoPeloDono ?? true,
          },
        })
        console.log(`  ~ atualizada (drift): ${r.meio} @ ${r.bankAccountId} → D+${r.diasUteisAtraso} sabDom=${r.recebeSabDom}`)
      } else {
        console.log(`  = já existe (igual): ${r.meio} @ ${r.bankAccountId} (${r.origemHint})`)
      }
      continue
    }
    await prisma.regraRecebimento.create({
      data: {
        perfilId: perfil.id,
        companyId: CACULA_COMPANY,
        bankAccountId: r.bankAccountId,
        meio: r.meio,
        diasUteisAtraso: r.diasUteisAtraso,
        recebeSabDom: r.recebeSabDom,
        vigenteDe: r.vigenteDe,
        vigenteAte: r.vigenteAte,
        origemHint: r.origemHint,
        confirmadoPeloDono: r.confirmadoPeloDono ?? true,
      },
    })
    criadas++
    console.log(`  + criada: ${r.meio} D+${r.diasUteisAtraso} sabDom=${r.recebeSabDom} (${r.origemHint})`)
  }
  console.log(`\n${criadas} regra(s) criada(s), ${regras.length - criadas} já existiam.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[seed-vendas-perfil] erro:', (e as Error).message)
  process.exit(1)
})
