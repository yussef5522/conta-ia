// ESTOQUE — ITENS DIGITADOS DO DANFE DE PAPEL (23/08).
//
// O caminhão chega com o DANFE impresso e o XML ainda não veio (a SEFAZ só libera depois
// da Ciência, e a Ciência é deferida). O dono NÃO pode ficar travado esperando: digita os
// itens do papel e o fluxo NORMAL de conferência roda em cima deles (mapear, fator,
// divergência, confirmar → movimentos).
//
// O valor do RESUMO já veio da SEFAZ (vNF confirmado no download), então dá pra conferir a
// digitação contra ele: a soma dos itens tem que bater com o total da nota. **AVISA, NÃO
// TRAVA** — a diferença pode ser legítima (ICMS-ST, frete, IPI, desconto entram no vNF e
// não no vProd dos itens; foi exatamente o caso do Frigorífico, 249,74 de ST). Travar aqui
// seria repetir o erro de tratar "não fecha" como "está errado".

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export class ItensManuaisError extends Error {}

export interface ItemManualInput {
  xProd: string
  qCom: number
  uCom: string
  vUnCom: number
}

export interface ConferenciaSoma {
  somaItens: number
  vNF: number | null
  diferenca: number | null
  bate: boolean
  aviso: string | null
}

/** Tolerância da conferência de digitação: 1 centavo por item (arredondamento) + 1. */
const tolerancia = (n: number) => 0.01 * n + 0.01

/**
 * Confere a SOMA dos itens digitados contra o total que a SEFAZ já confirmou.
 * PURA — testável sem banco. Nunca trava; devolve o aviso pra tela mostrar.
 */
export function conferirSoma(itens: ItemManualInput[], vNF: number | null): ConferenciaSoma {
  const somaItens = round2(itens.reduce((s, i) => s + i.qCom * i.vUnCom, 0))
  if (vNF == null) {
    return { somaItens, vNF: null, diferenca: null, bate: true, aviso: null }
  }
  const diferenca = round2(somaItens - vNF)
  const bate = Math.abs(diferenca) <= tolerancia(itens.length)
  if (bate) return { somaItens, vNF, diferenca, bate, aviso: null }
  const falta = diferenca < 0
  return {
    somaItens, vNF, diferenca, bate,
    aviso: falta
      ? `A soma dos itens (R$ ${somaItens.toFixed(2)}) está R$ ${Math.abs(diferenca).toFixed(2)} ABAIXO do total da nota (R$ ${vNF.toFixed(2)}). Pode ser ICMS-ST, frete ou IPI — que entram no total e não no preço dos itens — ou pode faltar item. Confira o papel; dá pra seguir assim mesmo.`
      : `A soma dos itens (R$ ${somaItens.toFixed(2)}) está R$ ${diferenca.toFixed(2)} ACIMA do total da nota (R$ ${vNF.toFixed(2)}). Provavelmente há desconto na nota, item repetido ou preço digitado errado. Confira; dá pra seguir assim mesmo.`,
  }
}

export function validarItens(itens: ItemManualInput[]): void {
  if (!itens.length) throw new ItensManuaisError('Digite ao menos um item da nota.')
  itens.forEach((i, idx) => {
    const n = idx + 1
    if (!i.xProd?.trim()) throw new ItensManuaisError(`Item ${n}: falta a descrição (copie do DANFE).`)
    if (!(i.qCom > 0)) throw new ItensManuaisError(`Item ${n} ("${i.xProd}"): a quantidade tem que ser maior que zero.`)
    if (!i.uCom?.trim()) throw new ItensManuaisError(`Item ${n} ("${i.xProd}"): falta a unidade da nota (CX, KG, UN…).`)
    if (!(i.vUnCom >= 0)) throw new ItensManuaisError(`Item ${n} ("${i.xProd}"): preço unitário inválido.`)
  })
}

export interface SalvarResult extends ConferenciaSoma { itensGravados: number }

/**
 * Grava os itens digitados como `stock_nfe_item` — a partir daí a tela de conferência não
 * distingue: o fluxo normal roda igual. NÃO marca `temXmlCompleto` (continua false: isto
 * é o papel, não o XML), e é isso que faz o movimento nascer `origem=DANFE_MANUAL` e o
 * juiz E10 parar de cobrar assim que a nota for conferida.
 *
 * Idempotente: redigitar substitui o que foi digitado antes (a nota ainda não foi
 * conferida). Depois de CONFIRMADA, recusa — o ledger já se moveu.
 */
export async function salvarItensManuais(
  input: { companyId: string; nfeId: string; itens: ItemManualInput[] },
  db: PrismaClient = defaultPrisma,
): Promise<SalvarResult> {
  validarItens(input.itens)

  const nota = await db.stockNfe.findFirst({
    where: { id: input.nfeId, companyId: input.companyId },
    select: { id: true, chave: true, status: true, vNF: true, temXmlCompleto: true },
  })
  if (!nota) throw new ItensManuaisError('Nota não encontrada.')
  if (nota.status === 'CONFIRMADA') throw new ItensManuaisError('Essa nota já foi conferida — o estoque já entrou. Para corrigir, estorne os movimentos.')
  if (nota.temXmlCompleto) throw new ItensManuaisError('Essa nota já tem o XML completo da SEFAZ — os itens vieram do arquivo, não precisa digitar.')

  const soma = conferirSoma(input.itens, nota.vNF)

  await db.$transaction(async (tx) => {
    // redigitar substitui (nota ainda não conferida — nada no ledger depende disto)
    await tx.stockNfeItem.deleteMany({ where: { companyId: input.companyId, nfeId: input.nfeId } })
    await tx.stockNfeItem.createMany({
      data: input.itens.map((i, idx) => ({
        companyId: input.companyId, nfeId: input.nfeId, chave: nota.chave, nItem: idx + 1,
        cProd: null, cEAN: null, xProd: i.xProd.trim(), ncm: null, cest: null, cfop: null,
        uCom: i.uCom.trim().toUpperCase(), qCom: i.qCom, vUnCom: i.vUnCom,
        vProd: round2(i.qCom * i.vUnCom), uTrib: null, qTrib: null,
      })),
    })
  })

  return { ...soma, itensGravados: input.itens.length }
}
