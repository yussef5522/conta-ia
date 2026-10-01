// ⭐⭐⭐ A LEITURA DA CAIXA DE ENTRADA — UM DONO SÓ (faxina de 15/09/2026).
//
// **Por que isto existe:** o badge do menu e a TELA respondem a MESMA pergunta —
// *"quantas linhas ainda esperam decisão minha?"*. Enquanto a consulta viveu dentro da
// rota, o badge só tinha duas saídas: chamar a rota por HTTP (caro, a cada 60 s) ou
// escrever a **segunda consulta** — que é como o menu passou meses dizendo um número e a
// tela mostrando outro (o defeito de 10/09, medido: o badge contava os pares 1:1 **sem os
// lotes**).
//
// ⛔ **A régua da fila mora aqui e em lugar nenhum mais.** Quem quiser contar linha
// esperando decisão chama `contarLinhasEsperandoDecisao`; quem quiser desenhar chama
// `lerCaixa`. As duas leem o MESMO recorte — inclusive o corte de época e o teto de 400.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { contarEstacoes, type ContadoresDoBalcao, type LinhaParaEstacao } from './caixa-de-entrada'
import { WHERE_ORIGEM_DO_EXTRATO } from './origem-do-extrato'

/** ⚠️ o que basta ler pra a lei das estações decidir — nada além disso */
export const SELECT_DA_CAIXA = {
  id: true, type: true, amount: true, date: true, description: true, counterpartyName: true,
  categoryId: true, reconciledWithId: true, isCardPayment: true, businessCreditCardId: true, transferGroupId: true,
  isInternalTransfer: true, pendingTransfer: true, ignoredAt: true, bankAccountId: true,
  reconciledFrom: { select: { id: true } },
  loanInstallmentPaid: { select: { id: true } },
  loanInstallmentPayments: { select: { id: true } },
  /**
   * ⭐⭐ 25/09 — o VÍNCULO com o contrato de investimento, no MESMO select.
   * ⚠️ Sem ele `temAporteVinculado` seria `false` pra toda linha e **todo aporte voltaria
   * pra caixa** — a doença do select incompleto, que este arquivo já documenta logo abaixo.
   */
  investmentContribution: { select: { id: true } },
  /**
   * ⭐⭐ 25/09 — O GRUPO DO DRE vem JUNTO, no mesmo select.
   *
   * ⛔ Sem o campo, `categoriaResolveSozinha` receberia `undefined` pra TODA linha e — como
   * a régua trata ausência como *"não resolve"* — o arquivo inteiro voltaria pra caixa. É a
   * doença do **select incompleto** (o PIX de 7.000, 17/08): o motor decide com um campo
   * que a consulta não trouxe, e **não dá erro: dá silêncio**.
   */
  category: { select: { dreGroup: true } },
} as const

/**
 * ⚠️ TETO DE LEITURA. A caixa é fila de TRABALHO, não arquivo: 400 linhas cobrem semanas
 * de extrato das cinco contas. ⛔ E ele é o MESMO pros dois leitores de propósito — badge
 * com teto diferente da tela é a divergência de novo, com outra roupa.
 */
export const TETO_DA_CAIXA = 400

/**
 * ⛔⛔⛔ **A FILA DE TRABALHO NUNCA TRUNCA O TRABALHO — O ARQUIVO SIM (01/10/2026).**
 *
 * **O defeito que isto conserta, medido em prod:** com o `take: 400` único e `date desc`, o
 * teto cortava pela linha **MAIS ANTIGA** — e das 7 linhas do extrato do banco caixa ele
 * alcançava **5**. As duas de 02/09 (a **COBRANÇA DE JUROS de R$ 1.148,05** e o **IOF de
 * R$ 25,34**) ficariam invisíveis *mesmo depois de consertado o filtro de origem*.
 *
 * ⚠️ Em 30/09 a decisão foi *"não subir o teto; a leitura DIZER quantas ficaram fora"* — e
 * ela foi tomada com uma medição que dizia **ZERO das invisíveis pedem decisão**. Hoje
 * **duas pedem**, e o mesmo raciocínio leva a outro lugar: *dizer que escondeu trabalho não
 * é o mesmo que não esconder*.
 *
 * ⭐ A varredura vai até **esgotar o período**, e o que ela guarda é assimétrico de
 * propósito: **toda** linha que está na CAIXA (o trabalho) e o ARQUIVO até o teto de
 * exibição. Os CONTADORES saem da varredura inteira — é isso que faz
 * `Σ período == caixa + arquivo` fechar **por conta**.
 */
export const TETO_DE_VARREDURA = 4000
/** quantas páginas de leitura por vez — 484 linhas hoje cabem numa só */
const PAGINA = 1000

export type LinhaCrua = {
  id: string; type: string; amount: number; date: Date
  description: string | null; counterpartyName: string | null
  categoryId: string | null; reconciledWithId: string | null; isCardPayment: boolean
  businessCreditCardId: string | null
  transferGroupId: string | null; isInternalTransfer: boolean; pendingTransfer: boolean
  ignoredAt: Date | null
  /** ⚠️ NULL de verdade: compra de cartão nasce sem conta bancária (o consumidor já trata) */
  bankAccountId: string | null
  reconciledFrom: { id: string }[]
  loanInstallmentPaid: { id: string } | null
  loanInstallmentPayments: { id: string }[]
  /** ⭐ 25/09 — o grupo do DRE da categoria, que decide se ela encerra a linha */
  category?: { dreGroup: string | null } | null
  /**
   * ⭐ 25/09 — a decisão *"esta saída não tem nota"*, INJETADA pela leitura.
   *
   * ⚠️ Não é coluna de `transactions`: ela vive em `conciliacao_avulsa_confirmada`, porque
   * decisão tem AUTOR e DATA (e um boolean não guarda nem um nem outro). Quem junta é a
   * `lerCaixa`, num lugar só — cada leitor buscando por conta própria é como dois deles
   * discordam sobre a mesma linha.
   */
  avulsaConfirmada?: boolean
  investmentContribution?: { id: string } | null
}

/** ⭐ a tradução da linha crua pra o que a LEI lê — um lugar só, senão as duas divergem */
export function paraLei(r: LinhaCrua): LinhaParaEstacao {
  return {
    categoryId: r.categoryId,
    dreGroupDaCategoria: r.category?.dreGroup ?? null,
    avulsaConfirmada: r.avulsaConfirmada ?? false,
    temAporteVinculado: r.investmentContribution != null,
    reconciledWithId: r.reconciledWithId,
    temReconciledFrom: r.reconciledFrom.length > 0,
    isCardPayment: r.isCardPayment,
    faturaVinculada: !!r.businessCreditCardId,
    temParcelaVinculada: !!r.loanInstallmentPaid || r.loanInstallmentPayments.length > 0,
    transferGroupId: r.transferGroupId,
    isInternalTransfer: r.isInternalTransfer,
    pendingTransfer: r.pendingTransfer,
    ignoredAt: r.ignoredAt,
    tipo: r.type,
  }
}

export interface CoberturaDaCaixa {
  lidas: number
  totalNoPeriodo: number
  truncado: boolean
  desde: Date | null
  /**
   * ⭐⭐ O INVARIANTE NA FRENTE DO DONO: a varredura alcançou o período INTEIRO?
   *
   * ⛔ Quando `false`, o teto duro de varredura bateu e **pode haver trabalho invisível** —
   * a tela tem que gritar, não sussurrar. Hoje é sempre `true` (484 de 4000).
   */
  periodoInteiro: boolean
}

export interface CaixaLida {
  rows: LinhaCrua[]
  contadores: ContadoresDoBalcao
  /** ⭐ a tela DIZ de quando ela conta — fila que mostra menos precisa dizer por quê */
  corte: Date | null
  /** ⭐ 30/09: quantas linhas o teto alcançou — truncar em silêncio afirma que se olhou tudo */
  cobertura: CoberturaDaCaixa
  /** nome de cada conta, pra tela nomear de onde a linha veio */
  nomeConta: Map<string, string>
}

/**
 * ⭐⭐ A LEITURA ÚNICA.
 *
 * ⚠️ **O CORTE DE ÉPOCA VALE AQUI** (decisão do dono, 15/09): *"os créditos históricos já
 * categorizados nascem em PAZ no arquivo, não como pendência retroativa"*. Sem ele, a
 * caixa abriria com anos de extrato pedindo decisão que o dono já tomou.
 */
export async function lerCaixa(empresaId: string, db: PrismaClient = defaultPrisma): Promise<CaixaLida> {
  const contas = await db.bankAccount.findMany({ where: { companyId: empresaId }, select: { id: true, name: true } })
  const empresa = await db.company.findUnique({ where: { id: empresaId }, select: { conciliarAPartirDe: true } })
  const corte = empresa?.conciliarAPartirDe ?? null

  /**
   * ⭐⭐⭐ O UNIVERSO — e a origem vem do **dono único da pergunta** (01/10).
   *
   * ⛔ Era `origin: 'OFX'` cravado, e por isso o extrato do **banco caixa** (que o banco só
   * entrega em PDF) ficou **inteiro invisível**: 7 linhas gravadas certas e nenhuma na
   * conciliação. *O formato do arquivo decidia se a linha existia.*
   */
  const where = {
    bankAccountId: { in: contas.map((c) => c.id) },
    ...WHERE_ORIGEM_DO_EXTRATO,
    lifecycle: 'EFFECTED' as const,
    ...(corte ? { date: { gte: corte } } : {}),
  }

  const totalNoPeriodo = await db.transaction.count({ where })

  /**
   * ⭐⭐ A VARREDURA — **o trabalho nunca é truncado; o arquivo sim.**
   *
   * ⚠️ As avulsas são buscadas **por página**, não numa consulta global: a tabela cresce com
   * o tempo e puxá-la inteira seria o oposto da lição do badge que virou 1,3 s (11/09).
   */
  const rows: LinhaCrua[] = []
  let escaneadas = 0
  let saidas = 0
  let entradas = 0
  let arquivo = 0
  let arquivoGuardado = 0
  let maisAntigaEscaneada: Date | null = null

  for (let pulo = 0; pulo < TETO_DE_VARREDURA; pulo += PAGINA) {
    const pagina = (await db.transaction.findMany({
      where, select: SELECT_DA_CAIXA, orderBy: { date: 'desc' }, skip: pulo, take: PAGINA,
    })) as unknown as LinhaCrua[]
    if (pagina.length === 0) break

    const avulsas = new Set(
      (await db.conciliacaoAvulsaConfirmada.findMany({
        where: { companyId: empresaId, transactionId: { in: pagina.map((r) => r.id) } },
        select: { transactionId: true },
      })).map((a) => a.transactionId),
    )

    for (const r of pagina) {
      r.avulsaConfirmada = avulsas.has(r.id)
      escaneadas++
      maisAntigaEscaneada = r.date
      const c = contarEstacoes([paraLei(r)])
      saidas += c.saidas
      entradas += c.entradas
      arquivo += c.arquivo
      if (c.arquivo === 0) {
        rows.push(r) // ⭐ está na CAIXA: entra SEMPRE, custe o que custar
      } else if (arquivoGuardado < TETO_DA_CAIXA) {
        rows.push(r) // o ARQUIVO é que cede espaço — ele não pede decisão
        arquivoGuardado++
      }
    }
    if (pagina.length < PAGINA) break
  }

  /**
   * ⭐ ORDEM RESTAURADA (data desc): a varredura guarda caixa e arquivo em ritmos
   * diferentes, então a lista sairia embaralhada — e a tela mostra isso ao dono.
   */
  rows.sort((a, b) => +b.date - +a.date)

  const cobertura: CoberturaDaCaixa = {
    lidas: rows.length,
    totalNoPeriodo,
    truncado: totalNoPeriodo > rows.length,
    /** ⭐ o dia mais ANTIGO que a varredura alcançou — é o que diz ATÉ ONDE se olhou */
    desde: maisAntigaEscaneada,
    periodoInteiro: escaneadas >= totalNoPeriodo,
  }

  return {
    rows,
    /**
     * ⭐⭐ OS CONTADORES SAEM DA VARREDURA INTEIRA, não das linhas guardadas — é isto que faz
     * `Σ período == caixa + arquivo` fechar **por conta**, que era o invariante que o dono
     * pediu. Contar só o que a tela desenha diria *"388 no arquivo"* quando há 465.
     */
    contadores: { saidas, entradas, arquivo, total: escaneadas },
    corte,
    cobertura,
    nomeConta: new Map(contas.map((c) => [c.id, c.name])),
  }
}

/**
 * ⭐ O NÚMERO DO BADGE — **a mesma leitura que a tela desenha**.
 *
 * ⛔ Conta LINHAS do extrato esperando decisão. Ele **não soma** com
 * `contarVinculosEsperandoDecisao`, que conta **CONTAS a pagar** sem par: casar uma linha
 * com uma conta apaga as duas de uma vez, e somar seria dupla contagem.
 */
export async function contarLinhasEsperandoDecisao(empresaId: string, db: PrismaClient = defaultPrisma): Promise<number> {
  const { contadores } = await lerCaixa(empresaId, db)
  return contadores.saidas + contadores.entradas
}
