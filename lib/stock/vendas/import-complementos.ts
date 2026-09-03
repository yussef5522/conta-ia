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
import { SABORES_DO_CARDAPIO, grupoPeloCardapio } from './grupo-complemento'

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

/**
 * Quantos sabores do cardápio precisam casar pra o sistema aceitar que o cardápio é AQUELE.
 * 10 é folgado pra baixo (a Caçula casa 51) e alto o bastante pra um cliente que vende
 * "BACON" e "FRANGO" sem ser pizzaria não herdar 52 nomes que não são dele.
 */
const MIN_EVIDENCIA_CARDAPIO = 10

/**
 * ⭐⭐ DIA × PERÍODO — e a diferença é uma ARMADILHA DE LEDGER, não organização.
 *
 * O relatório do Suitable **não traz data nenhuma** (conferido no arquivo: zero ocorrência de
 * data). Quem escolhe o dia é o dono. Só que ele pode exportar um DIA ou um PERÍODO INTEIRO,
 * e os dois caem na mesma tabela, que é indexada por `data`.
 *
 * ⛔⛔ SE UM PERÍODO ENTRAR COMO DIA, ele vira uma bomba pra quando a BAIXA for ligada:
 * "processar o dia X" baixaria as **7.648 ocorrências do mês inteiro** de uma vez, com cara
 * de operação normal. Por isso o período é marcado no `importId` (`comp-periodo-…`) e
 * **`ehLinhaDePeriodo` existe pra a baixa RECUSAR essas linhas** — a decisão fica registrada
 * aqui, hoje, e não na memória de quem for ligar a baixa daqui a um mês.
 *
 * ⚠️ Período serve pra SEMEAR a prateleira (o dono precisa da lista completa de nomes pra
 * montar as fichas) e pra priorizar por ocorrência. Não serve pra baixar estoque.
 */
export type ModoImportComplemento = 'DIA' | 'PERIODO'

export const importIdDe = (companyId: string, data: string, modo: ModoImportComplemento) =>
  modo === 'PERIODO' ? `comp-periodo-${companyId}-${data}` : `comp-${companyId}-${data}`

/** ⛔ a baixa TEM que chamar isto e pular: linha de período não é venda de um dia. */
export const ehLinhaDePeriodo = (importId: string) => importId.startsWith('comp-periodo-')

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
  modo: ModoImportComplemento = 'DIA',
): Promise<{ importId: string; linhas: number; ocorrencias: number; substituiu: boolean; modo: ModoImportComplemento }> {
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
    const importId = importIdDe(companyId, data, modo)
    // ⭐⭐ O CATÁLOGO ANDA JUNTO, NA MESMA TRANSAÇÃO. Nome visto num relatório é nome que
    // EXISTE no PDV — e isso não envelhece. Sem isto, apagar venda velha (ou reimportar um
    // dia menor) apagaria a LISTA DE TRABALHO do dono junto com o dado de venda.
    // ⚠️ Fora da transação, um import que falhasse no meio deixaria o catálogo dizendo que
    // conhece nomes que nenhuma linha sustenta.
    const nomes = [...new Set(p.linhas.map((l) => l.produto))]
    // ⚠️ 4 queries, não 3 POR NOME: com 215 nomes o laço com upsert seriam 645 idas ao banco
    // dentro de uma transação — lento e travando linha por linha.
    // ⚠️ E sem `skipDuplicates`: ele não existe no SQLite do dev, e a suíte roda lá.
    const jaNoCatalogo = new Set((await tx.stockVendaComplementoNome.findMany({
      where: { companyId, nomeSuitable: { in: nomes } }, select: { nomeSuitable: true },
    })).map((c) => c.nomeSuitable))
    const novos = nomes.filter((n) => !jaNoCatalogo.has(n))
    if (novos.length) {
      await tx.stockVendaComplementoNome.createMany({
        data: novos.map((nomeSuitable) => ({ companyId, nomeSuitable, primeiroEm: dia, ultimoEm: dia })),
      })
    }
    // ⚠️ as datas só andam pro lado certo: importar um dia ANTIGO não pode fazer o nome
    // parecer recém-visto, nem um dia novo reescrever a primeira aparição.
    await tx.stockVendaComplementoNome.updateMany({
      where: { companyId, nomeSuitable: { in: nomes }, ultimoEm: { lt: dia } }, data: { ultimoEm: dia },
    })
    await tx.stockVendaComplementoNome.updateMany({
      where: { companyId, nomeSuitable: { in: nomes }, primeiroEm: { gt: dia } }, data: { primeiroEm: dia },
    })
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
      modo,
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
  const [linhas, mapeados, catalogo] = await Promise.all([
    db.stockVendaComplementoLinha.findMany({
      where: { companyId }, select: { nomeSuitable: true, ocorrencias: true, data: true },
    }),
    db.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    // ⭐ o CATÁLOGO é a lista de trabalho: nome conhecido não depende de existir venda
    db.stockVendaComplementoNome.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
  ])

  const comLinha = new Set(linhas.map((l) => l.nomeSuitable))
  const entradas = [
    ...linhas.map((l) => ({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias })),
    // ⭐ o nome mapeado que perdeu a linha entra com 0 — visível, nunca sumido
    ...mapeados.filter((m) => !comLinha.has(m.nomeSuitable)).map((m) => ({ nomeSuitable: m.nomeSuitable, ocorrencias: 0 })),
    // ⭐⭐ e o nome do CATÁLOGO que hoje não tem venda nenhuma — com 0, nunca ausente
    ...catalogo.filter((c) => !comLinha.has(c.nomeSuitable)).map((c) => ({ nomeSuitable: c.nomeSuitable, ocorrencias: 0 })),
  ]

  /**
   * ⭐⭐ O SABOR DO CARDÁPIO QUE AINDA NÃO VENDEU TAMBÉM APARECE, com 0 ocorrências.
   *
   * ⚠️ PEDIDO DO DONO, e o motivo é operacional: *"não quero descobrir na primeira venda
   * deles que não tinham ficha"*. Um dia de relatório não contém o cardápio inteiro — em
   * 29/08, 5 dos 52 sabores não venderam (PIZZA ATUM, MEXICANA, HOT DOG, CHOCOLATE PRETO,
   * KIT KAT). Sem isto eles só apareceriam **no dia em que fossem vendidos**, justamente
   * quando já é tarde.
   *
   * ⛔⛔ E POR QUE ISTO É GATEADO POR EVIDÊNCIA, NÃO SOLTO: a lista de sabores é o cardápio
   * da **Caçula**, escrito em código. Injetar os 52 em TODA empresa encheria a prateleira de
   * um cliente qualquer com nomes de pizza que ele nunca vendeu — dado inventado com cara de
   * dado real, e multi-tenant é onde isso dói mais. Então só injeta onde o próprio relatório
   * JÁ PROVOU que o cardápio é este (10+ sabores casando exato; a Caçula casa 51 de 52).
   */
  const conhecidos = new Set(entradas.map((e) => e.nomeSuitable))
  const casaram = [...conhecidos].filter((n) => grupoPeloCardapio(n) === 'SABOR').length
  if (casaram >= MIN_EVIDENCIA_CARDAPIO) {
    const jaTem = new Set([...conhecidos].map((n) => n.toUpperCase()))
    for (const s of SABORES_DO_CARDAPIO) if (!jaTem.has(s.toUpperCase())) entradas.push({ nomeSuitable: s, ocorrencias: 0 })
  }

  const dias = [...new Set(linhas.map((l) => l.data.toISOString().slice(0, 10)))].sort()
  return {
    prateleira: await prateleiraDeComplementos(companyId, entradas, db),
    periodo: dias.length ? { de: dias[0], ate: dias[dias.length - 1], dias: dias.length } : null,
  }
}
