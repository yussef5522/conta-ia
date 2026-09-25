// ⭐⭐⭐ "O QUE HOUVE COM A PARCELA 002?" — A PERGUNTA TEM UM DONO (13/09/2026).
//
// **O caso que motivou:** o dono abriu o card do Casper, não achou a parcela 002 da NF
// 967122 nas notas abertas, foi no Contas a Pagar e **não achou em estado nenhum**. Ela
// estava **PAGA** — conciliada com uma linha da stone — e por decisão de 28/05 conta
// conciliada **sai** do Contas a Pagar (ela vive em Movimentações, pra não aparecer em duas
// telas). Tudo certo no dado; **faltava a tela responder**.
//
// ⭐ **Régua dele:** *"é onde a pergunta 'o que houve com a 002?' nasce e morre"* — a nota.
//
// ⚠️ **E isto NÃO relê as duplicatas cruas.** Quem diz *"quais parcelas valem hoje"* é o
// `combinadoDaNota` desde 29/08 — e foi exatamente por ler o XML direto que o recibo mostrou
// 3 parcelas depois de uma renegociação pra 5. Aqui ele é a fonte; o que nasce é só o
// ESTADO de cada uma.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { combinadoDaNota } from './combinado'
import { parcelasNaoEnviadas } from './vencimento'

// ⚠️ o mesmo `Db` de `combinado.ts` (aceita o client transacional) — tipos diferentes aqui
// obrigariam um cast na fronteira, e cast é onde o erro passa calado
type Db = PrismaClient | Prisma.TransactionClient

export interface LinhaQuePagou {
  transactionId: string
  data: string
  valor: number
  conta: string | null
  descricao: string
  /** ⭐ o que a linha tinha a mais que a parcela — os juros/tarifa que o dono nomeou */
  diferenca: number
}

export interface ParcelaComEstado {
  numero: string
  valor: number
  vencimento: string | null
  origem: string
  /**
   * ABERTA · PAGA · PAGA_SEM_VINCULO (marcada paga na mão, sem linha do extrato)
   * ⭐ A_DEFINIR = a nota deve e **ninguém combinou a data** (13/09). Não é ausência de
   * dado: é trabalho pendente, e é o estado das 21 notas que o F5 conta desde 03/09.
   * ⛔ SEM_CONTA = a ponte nunca criou a conta a pagar (o boleto não foi enviado) —
   * e isso é um estado REAL, não um erro: o dono pode não ter enviado ainda.
   */
  estado: 'ABERTA' | 'PAGA' | 'PAGA_SEM_VINCULO' | 'SEM_CONTA' | 'A_DEFINIR'
  /** a conta a pagar dessa parcela — `null` quando nunca foi enviada pro financeiro */
  transactionId: string | null
  pagaEm: string | null
  /** ⭐ a linha do extrato que pagou — é o link que fecha a pergunta */
  linha: LinhaQuePagou | null
  frase: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/**
 * ⭐⭐ O ESTADO DE CADA PARCELA DA NOTA. Só LÊ.
 *
 * ⚠️ Falha macia por desenho: se a ponte ou o financeiro estourarem, a parcela vem
 * `SEM_CONTA` com o motivo — **o recibo não pode cair porque o estado de uma parcela não
 * deu pra resolver** (a mesma disciplina do selo de conferência nas Contas, 29/08).
 */
export async function estadoDasParcelas(
  companyId: string, nfeId: string, db: Db = defaultPrisma,
): Promise<ParcelaComEstado[]> {
  const combinado = await combinadoDaNota(companyId, nfeId, db)
  if (!combinado) return []

  // ⭐⭐ A NOTA QUE DEVE E NÃO TEM DATA (13/09) — o estado das 21 do F5.
  //
  // ⚠️ `combinadoDaNota` responde *"quais parcelas VALEM hoje"* e, por desenho, uma parcela
  // sem data não vale (ela não pode virar conta a pagar — `dueDate` alimenta fluxo de caixa
  // e DRE). Então a nota sem vencimento voltava **lista vazia**, e o recibo ficava MUDO
  // justamente onde havia dívida. **Vazio não é "não deve nada".**
  //
  // ⛔ E não nasce um terceiro leitor: quem responde *"o que está sem data"* é o
  // `parcelasNaoEnviadas`, dono dessa pergunta desde 03/09 — o mesmo que alimenta o F5.
  if (combinado.parcelas.length === 0) {
    const semData = (await parcelasNaoEnviadas(companyId, db)).filter((s) => s.nfeId === nfeId && !s.enviada)
    return semData.map((s, i): ParcelaComEstado => ({
      numero: s.nDup ?? String(i + 1).padStart(3, '0'),
      valor: s.valor, vencimento: null, origem: 'A_DEFINIR',
      estado: 'A_DEFINIR', transactionId: null, pagaEm: null, linha: null,
      // ⭐ a frase diz o GESTO, não o estado — "sem data" sozinho não ensina o que fazer
      frase: 'sem vencimento combinado — defina as parcelas pra virar conta a pagar',
    }))
  }

  const links = await db.stockPayableLink.findMany({
    where: { companyId, origem: 'NFE', refId: nfeId },
    select: { nDup: true, transactionId: true },
  })
  const txPorNumero = new Map(links.map((l) => [l.nDup, l.transactionId]))

  const txs = links.length
    ? await db.transaction.findMany({
      where: { id: { in: links.map((l) => l.transactionId) } },
      select: { id: true, amount: true, lifecycle: true, status: true, paymentDate: true, reconciledWithId: true },
    })
    : []
  const porId = new Map(txs.map((t) => [t.id, t]))

  // as linhas do extrato que pagaram — uma consulta só, não uma por parcela
  const linhaIds = txs.map((t) => t.reconciledWithId).filter((x): x is string => !!x)
  const linhas = linhaIds.length
    ? await db.transaction.findMany({
      where: { id: { in: linhaIds } },
      select: { id: true, date: true, amount: true, description: true, bankAccount: { select: { name: true } } },
    })
    : []
  const porLinha = new Map(linhas.map((l) => [l.id, l]))

  return combinado.parcelas.map((p): ParcelaComEstado => {
    const txId = txPorNumero.get(p.numero) ?? null
    const tx = txId ? porId.get(txId) : undefined
    const venc = p.dVenc ? p.dVenc.toISOString().slice(0, 10) : null

    if (!tx) {
      return {
        numero: p.numero, valor: p.valor, vencimento: venc, origem: p.origem,
        estado: 'SEM_CONTA', transactionId: null, pagaEm: null, linha: null,
        // ⚠️ diz o que FALTA fazer, não só o que falta existir
        frase: 'ainda não foi enviada pro Contas a Pagar',
      }
    }

    const pagaEm = tx.paymentDate?.toISOString().slice(0, 10) ?? null
    const l = tx.reconciledWithId ? porLinha.get(tx.reconciledWithId) : undefined

    if (l) {
      const diferenca = r2(Math.abs(l.amount) - p.valor)
      return {
        numero: p.numero, valor: p.valor, vencimento: venc, origem: p.origem,
        estado: 'PAGA', transactionId: tx.id, pagaEm,
        linha: {
          transactionId: l.id, data: l.date.toISOString().slice(0, 10), valor: Math.abs(l.amount),
          conta: l.bankAccount?.name ?? null, descricao: l.description ?? '', diferenca,
        },
        // ⭐ A FRASE QUE FECHA A PERGUNTA — data, conta e os juros por extenso
        frase: `paga em ${ddmm(l.date)} pela linha de ${brl(Math.abs(l.amount))}`
          + `${l.bankAccount?.name ? ` na ${l.bankAccount.name}` : ''}`
          // ⚠️ a diferença aparece NOMEADA: é o gesto de juros/tarifa de 12/09, e escondê-la
          // faria o dono ver dois números que não batem sem explicação
          + `${Math.abs(diferenca) >= 0.01 ? ` · ${brl(Math.abs(diferenca))} de ${diferenca > 0 ? 'juros/tarifa' : 'desconto'}` : ''}`,
      }
    }

    if (pagaEm || tx.lifecycle === 'EFFECTED') {
      return {
        numero: p.numero, valor: p.valor, vencimento: venc, origem: p.origem,
        estado: 'PAGA_SEM_VINCULO', transactionId: tx.id, pagaEm, linha: null,
        // ⛔ "paga sem vínculo" é DIFERENTE de "paga": ninguém apontou o dinheiro que saiu,
        // e é justamente esse estado que o juiz F1 vigia como dupla contagem
        frase: pagaEm ? `marcada paga em ${ddmm(new Date(pagaEm))}, sem linha do extrato vinculada` : 'marcada paga, sem data',
      }
    }

    return {
      numero: p.numero, valor: p.valor, vencimento: venc, origem: p.origem,
      estado: 'ABERTA', transactionId: tx.id, pagaEm: null, linha: null,
      frase: venc ? `em aberto · vence ${ddmm(new Date(venc))}` : 'em aberto',
    }
  })
}
