// ⭐⭐ IMPORT DO RELATÓRIO DE COMPLEMENTOS — espelha o de produtos (02/09/2026).
//
// Mesma competência por dia, mesma proteção de reimport, mesmo preview→confirmar. O que
// muda é só o MAPA DE COLUNAS (a quantidade é a 3ª, não a 2ª) e a semântica da linha:
// **ocorrência, não unidade vendida**.
//
// ⭐ A REGRA DE NEGÓCIO, decidida pelo dono e que governa este arquivo inteiro:
//     **1 ocorrência de complemento = 1 explosão da ficha dele, SEMPRE**, independente do
//     tamanho da pizza. Quem garante é o CARDÁPIO: pizza pequena obriga escolher 2 sabores,
//     grande 4 — uma pizza grande inteira de calabresa chega aqui como **4 ocorrências**.
//     ⚠️ NADA de fração por tamanho, NADA de média: o PDV já entregou a conta feita, e
//     inventar um fator por tamanho seria refazer (errado) uma conta que já veio pronta.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { parseSuitable, COLUNAS_COMPLEMENTOS } from './parse-suitable'
import { prateleiraDeComplementos, type LinhaPrateleira } from './complemento-map'

export class ImportComplementoError extends Error {}

export interface PrevisaoComplementos {
  data: string
  totalLinhas: number
  totalOcorrencias: number
  /** a prateleira do período, ordenada por ocorrências DESC */
  prateleira: LinhaPrateleira[]
  /** quantos já têm destino (ficha ou ignorar) */
  comDestino: number
  pendentes: number
  /** nomes que também existem no relatório de PRODUTOS — risco de baixa dupla */
  nosDoisRelatorios: number
  /** já existe import deste dia? (reimportar SUBSTITUI) */
  jaImportado: boolean
}

const diaUtc = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`)

/** PREVIEW — não grava nada. Mostra o que entraria e o estado do mapeamento. */
export async function previewComplementos(
  companyId: string, data: string, html: string, db: PrismaClient = defaultPrisma,
): Promise<PrevisaoComplementos> {
  const p = parseSuitable(html, COLUNAS_COMPLEMENTOS)
  if (!p.linhas.length) throw new ImportComplementoError('Nenhum complemento encontrado no arquivo.')

  const linhas = p.linhas.map((l) => ({ nomeSuitable: l.produto, ocorrencias: l.quantidade }))
  const prateleira = await prateleiraDeComplementos(companyId, linhas, db)
  const jaImportado = (await db.stockVendaComplementoLinha.count({
    where: { companyId, data: diaUtc(data) },
  })) > 0

  return {
    data,
    totalLinhas: p.linhas.length,
    totalOcorrencias: p.linhas.reduce((s, l) => s + l.quantidade, 0),
    prateleira,
    comDestino: prateleira.filter((x) => x.destino !== 'SEM_FICHA').length,
    pendentes: prateleira.filter((x) => x.destino === 'SEM_FICHA').length,
    nosDoisRelatorios: prateleira.filter((x) => x.tambemProduto).length,
    jaImportado,
  }
}

/**
 * CONFIRMA — grava as linhas do dia.
 *
 * ⚠️ REIMPORT SUBSTITUI, igual ao de produtos: apaga as linhas daquele dia e regrava. É
 * seguro **ENQUANTO NADA BAIXA** — a linha não é o dado contábil; o movimento de estoque é,
 * e ele só nasce na BAIXA (outro gesto, com estorno-e-refaz próprio).
 *
 * ⛔⛔⛔ LEIA ISTO ANTES DE LIGAR A BAIXA (caso levantado pelo dono em 02/09, antes de o
 * problema existir): **reimportar um dia JÁ BAIXADO com números diferentes.**
 *
 *   hoje:  linhas do dia 01/09 dizem CALABRESA 1.220  →  reimport diz 1.190  →  substitui
 *          e pronto, porque nenhum movimento foi gerado a partir delas.
 *   depois: se o dia já foi BAIXADO, existe um `BAIXA_VENDA` de 1.220 no ledger. Substituir
 *          a linha por 1.190 deixa **linha nova + movimento velho convivendo em silêncio** —
 *          o estoque baixou 30 a mais do que o relatório atual diz, e nada na tela conta isso.
 *
 * ⭐ AS DUAS SAÍDAS ACEITAS (escolha do dono quando chegar a hora), e nenhuma é "não fazer
 * nada": **ou** o reimport de dia baixado dispara o **estorno-e-refaz** na hora (o caminho
 * que `montarPlanoReprocesso` já faz pros produtos), **ou** ele marca o dia como
 * **"precisa reprocessar" VISÍVEL** na tela. Substituir calado não é opção — é a classe do
 * "estoque invisível" e do selo verde de graça que este módulo já pagou caro.
 *
 * ⚠️ Este comentário existe porque a decisão é fácil de esquecer: hoje o código está
 * CORRETO, e vai continuar compilando e passando nos testes no dia em que ficar errado.
 *
 * ⛔ E NÃO BAIXA NADA AQUI. Importar é trazer o que o PDV vendeu; baixar é decisão
 * separada, com preview próprio — a mesma separação do fluxo de produtos.
 */
export async function confirmarComplementos(
  companyId: string, data: string, html: string, userId?: string, db: PrismaClient = defaultPrisma,
): Promise<{ importId: string; linhas: number; ocorrencias: number; substituiu: boolean }> {
  const p = parseSuitable(html, COLUNAS_COMPLEMENTOS)
  if (!p.linhas.length) throw new ImportComplementoError('Nenhum complemento encontrado no arquivo.')
  const dia = diaUtc(data)

  // o mapa DE COMPLEMENTOS (não o de produtos) diz o que já tem destino
  const mapeados = new Set(
    (await db.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }))
      .map((m) => m.nomeSuitable),
  )

  return db.$transaction(async (tx) => {
    const antes = await tx.stockVendaComplementoLinha.count({ where: { companyId, data: dia } })
    await tx.stockVendaComplementoLinha.deleteMany({ where: { companyId, data: dia } })
    // ⚠️ `importId` é o dia: reimportar o mesmo dia reaproveita a chave, e a baixa
    // (`receiptId`) continua encontrando as linhas certas depois do reimport.
    const importId = `comp-${companyId}-${data}`
    await tx.stockVendaComplementoLinha.createMany({
      data: p.linhas.map((l) => ({
        companyId, importId, data: dia,
        nomeSuitable: l.produto,
        ocorrencias: l.quantidade,
        valorTotal: l.valorTotal,
        mapeadoNoImport: mapeados.has(l.produto),
      })),
    })
    void userId
    return {
      importId,
      linhas: p.linhas.length,
      ocorrencias: p.linhas.reduce((s, l) => s + l.quantidade, 0),
      substituiu: antes > 0,
    }
  })
}

export interface PrateleiraCompleta {
  prateleira: LinhaPrateleira[]
  /** o período que a prateleira cobre — o DELA, não o do relatório de produtos */
  periodo: { de: string; ate: string; dias: number } | null
}

/**
 * A prateleira a partir do que já está GRAVADO (a aba abre sem precisar de upload).
 *
 * ⭐⭐ MAPEAR É TRABALHO INDEPENDENTE DE PERÍODO (regra do dono, 02/09): **nome conhecido
 * nunca some por causa de data.** Por isso a lista é a UNIÃO de (nomes com linha importada)
 * ∪ (nomes que já têm destino no mapa).
 *
 * ⛔ SEM A UNIÃO HÁ UM SUMIÇO SILENCIOSO REAL: reimportar um dia SUBSTITUI as linhas dele
 * (`deleteMany` + `createMany`). Um nome que só existia na versão antiga sai da tabela — e,
 * se ele já estava mapeado, o mapeamento continua no banco mas **desaparece da tela**, com
 * a ocorrência zerada e nenhum aviso. É a mesma família do "estoque invisível": some da
 * vista, continua valendo na hora da baixa.
 *
 * ⚠️ As OCORRÊNCIAS seguem sendo a soma do que foi importado (número informativo); o nome
 * mapeado sem linha aparece com 0 e no fim da lista, que é o lugar honesto dele.
 */
export async function prateleiraGravada(
  companyId: string, db: PrismaClient = defaultPrisma,
): Promise<PrateleiraCompleta> {
  const [linhas, mapeados] = await Promise.all([
    db.stockVendaComplementoLinha.findMany({
      where: { companyId }, select: { nomeSuitable: true, ocorrencias: true, data: true },
    }),
    db.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
  ])

  const comLinha = new Set(linhas.map((l) => l.nomeSuitable))
  const entradas = [
    ...linhas.map((l) => ({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias })),
    // ⭐ o nome mapeado que perdeu a linha entra com 0 — visível, nunca sumido
    ...mapeados.filter((m) => !comLinha.has(m.nomeSuitable)).map((m) => ({ nomeSuitable: m.nomeSuitable, ocorrencias: 0 })),
  ]

  const dias = [...new Set(linhas.map((l) => l.data.toISOString().slice(0, 10)))].sort()
  return {
    prateleira: await prateleiraDeComplementos(companyId, entradas, db),
    periodo: dias.length ? { de: dias[0], ate: dias[dias.length - 1], dias: dias.length } : null,
  }
}
