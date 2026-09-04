// ⭐⭐⭐ "A DEFINIR" — a conta que existe sem data, à vista (03/09/2026).
//
// ⛔ O QUE ACONTECIA ANTES, medido em prod: nota sem boleto (pix/dinheiro combinado) **não
// gerava sugestão nenhuma**, e a duplicata sem data era descartada em silêncio por
// `combinadoDaNota`. Resultado: **21 notas · R$ 8.588,75** passaram pelo estoque e nunca
// chegaram ao Contas a Pagar. O dinheiro sai do bolso do dono e nunca aparece no fluxo.
//
// ⚠️ E ERA INVISÍVEL TAMBÉM PRO JUIZ: o F3 vigia sugestão parada há 7 dias, e **essas notas
// não geravam sugestão** — a mesma cegueira do E15 de 23/08: *invariante que olha a tabela
// do PROCESSO nunca vê a tentativa que NÃO ACONTECEU*. Por isso o F5 existe.
//
// ⭐ O DESENHO, aprovado pelo dono:
//   · a sugestão nasce SEMPRE (sem duplicata → uma pelo total da nota, `dVenc = null`)
//   · `A DEFINIR` é **derivado** de `dVenc === null` — estado que não pode envelhecer
//   · a conta no FINANCEIRO só nasce quando o dono define a data (decisão (a), opção A):
//     `dueDate` alimenta fluxo de caixa, DRE e relatórios, e um null ali vazaria pra tudo
//   · vencimento é COMBINADO: editável, com rastro de quem definiu e quando

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export class VencimentoError extends Error {}

/**
 * ⭐ De onde veio a data. **A lista mora AQUI, não num CHECK do banco** (lição de 04/09):
 * origem é domínio ABERTO — nasceu com 2 valores e ganhou o 3º em 24 horas. Crescer aqui é
 * editar um union; crescer no CHECK exigiria ALTER, que o módulo proíbe.
 *   DONO                → combinou com o fornecedor e definiu depois, na tela de boletos
 *   DONO_NO_RECEBIMENTO → o boleto de PAPEL chegou com a mercadoria e ele digitou na hora
 *   BOLETO              → chegou o documento (XML/boleto) com a data
 */
export type OrigemVencimento = 'DONO' | 'DONO_NO_RECEBIMENTO' | 'BOLETO'

/** ⭐ derivado, nunca gravado: sem data = a definir. */
export const ehADefinir = (dVenc: Date | string | null | undefined): boolean => !dVenc

export interface ParcelaSemData {
  suggestionId: string
  nfeId: string
  chave: string
  supplierNome: string | null
  valor: number
  nDup: string | null
  /** já foi enviada pro financeiro? (então não é mais trabalho pendente) */
  enviada: boolean
}

/**
 * As sugestões sem data — a lista de trabalho *"combinar o vencimento com o fornecedor"*.
 *
 * ⚠️ Exclui as já enviadas: conta que virou obrigação no financeiro tem data por definição
 * (a ponte recusa sem), então listá-la aqui seria cobrar trabalho já feito.
 */
export async function parcelasSemData(companyId: string, db: Db = defaultPrisma): Promise<ParcelaSemData[]> {
  const sugestoes = await db.stockPayableSuggestion.findMany({
    where: { companyId, dVenc: null },
    select: { id: true, nfeId: true, chave: true, supplierNome: true, valor: true, nDup: true },
    orderBy: { criadoEm: 'asc' },
  })
  if (!sugestoes.length) return []
  const enviadas = new Set((await db.stockPayableLink.findMany({
    where: { companyId, suggestionId: { in: sugestoes.map((s) => s.id) } },
    select: { suggestionId: true },
  })).map((l) => l.suggestionId))

  return sugestoes.map((s) => ({
    suggestionId: s.id, nfeId: s.nfeId, chave: s.chave, supplierNome: s.supplierNome,
    valor: s.valor, nDup: s.nDup, enviada: enviadas.has(s.id),
  }))
}

export interface ConflitoDeData {
  /** a data que o dono tinha posto */
  daSua: Date
  /** a data que o documento traz */
  doBoleto: Date
}

export interface ResultadoDefinir {
  suggestionId: string
  dVenc: Date
  /** quando o boleto chega com data DIFERENTE da que o dono pôs: a tela mostra as duas */
  conflito: ConflitoDeData | null
  gravou: boolean
}

/**
 * Define (ou troca) o vencimento de uma sugestão, com rastro.
 *
 * ⛔⛔ BOLETO NUNCA TROCA EM SILÊNCIO. Se a data já foi posta pelo DONO e chega um documento
 * com outra, esta função **não grava**: devolve o conflito pra a tela mostrar as duas datas
 * (*"você pôs 10/09; o boleto diz 12/09"*) e o dono confirma com `aceitarConflito`.
 * É a mesma regra do "categoria é decisão do dono" e do combinado × nota: **o sistema
 * mostra, o dono decide.**
 */
export async function definirVencimento(
  companyId: string,
  suggestionId: string,
  dVenc: Date,
  origem: OrigemVencimento,
  userId?: string,
  db: PrismaClient = defaultPrisma,
  aceitarConflito = false,
): Promise<ResultadoDefinir> {
  if (Number.isNaN(dVenc.getTime())) throw new VencimentoError('Data inválida.')

  const s = await db.stockPayableSuggestion.findFirst({
    where: { id: suggestionId, companyId },
    select: { id: true, dVenc: true },
  })
  if (!s) throw new VencimentoError('Essa parcela não existe nesta empresa.')

  // ⛔ conta já enviada pro financeiro: mudar a data lá é gesto de LÁ (a conta a pagar tem a
  // própria tela de edição). Trocar aqui deixaria as duas pontas discordando em silêncio.
  const link = await db.stockPayableLink.findFirst({ where: { companyId, suggestionId }, select: { id: true } })
  if (link) throw new VencimentoError('Esta parcela já virou conta a pagar — a data se muda no Contas a Pagar.')

  const mesmoDia = s.dVenc && s.dVenc.toISOString().slice(0, 10) === dVenc.toISOString().slice(0, 10)
  if (s.dVenc && !mesmoDia && origem === 'BOLETO' && !aceitarConflito) {
    return { suggestionId, dVenc: s.dVenc, conflito: { daSua: s.dVenc, doBoleto: dVenc }, gravou: false }
  }

  await db.$transaction(async (tx) => {
    await tx.stockPayableSuggestion.update({ where: { id: suggestionId }, data: { dVenc } })
    // ⭐ o rastro entra na MESMA transação: data sem quem-decidiu é número sem dono, e é
    // exatamente o que o contador pergunta três meses depois.
    await tx.stockVencimentoEvento.create({
      data: { companyId, suggestionId, dVencAnterior: s.dVenc, dVencNovo: dVenc, origem, criadoPorId: userId ?? null },
    })
  })

  return { suggestionId, dVenc, conflito: null, gravou: true }
}

export interface RastroVencimento {
  dVencAnterior: Date | null
  dVencNovo: Date
  origem: OrigemVencimento
  criadoEm: Date
  criadoPorNome: string | null
}

/** O rastro de uma parcela — vira a frase *"definido por você em DD/MM"* na tela. */
export async function rastroDoVencimento(
  companyId: string, suggestionId: string, db: Db = defaultPrisma,
): Promise<RastroVencimento[]> {
  const rows = await db.stockVencimentoEvento.findMany({
    where: { companyId, suggestionId }, orderBy: { criadoEm: 'desc' },
  })
  if (!rows.length) return []
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.criadoPorId).filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  })
  const nome = new Map(users.map((u) => [u.id, u.name]))
  return rows.map((r) => ({
    dVencAnterior: r.dVencAnterior, dVencNovo: r.dVencNovo,
    origem: r.origem as OrigemVencimento, criadoEm: r.criadoEm,
    criadoPorNome: r.criadoPorId ? nome.get(r.criadoPorId) ?? null : null,
  }))
}

/**
 * Registra o rastro de uma parcela que **já nasceu com data** na conferência.
 *
 * ⚠️ Existe separado de `definirVencimento` porque ali a data é uma TROCA (tem `anterior`,
 * tem conflito a resolver); aqui é o nascimento — não há o que comparar, e a sugestão está
 * sendo criada na mesma transação. Forçar o mesmo caminho exigiria a sugestão já existir.
 */
export async function registrarVencimentoNoRecebimento(
  db: Db, companyId: string, suggestionId: string, dVenc: Date, userId?: string,
): Promise<void> {
  await db.stockVencimentoEvento.create({
    data: { companyId, suggestionId, dVencAnterior: null, dVencNovo: dVenc, origem: 'DONO_NO_RECEBIMENTO', criadoPorId: userId ?? null },
  })
}

export interface ParcelaDoPapel { dVenc: Date; valor: number }

export interface ConferenciaDePagamento {
  ok: boolean
  erros: string[]
  soma: number
}

const CENTAVO = 0.01
const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⭐⭐ VALIDA o pagamento digitado do boleto de PAPEL contra o total da nota.
 *
 * ⛔ RECUSA se não fechar AO CENTAVO — igual a todo resto do módulo. A nota é fato assinado
 * pela SEFAZ: parcela que não soma o total é erro de digitação, e deixar passar criaria
 * dívida com valor errado no fluxo de caixa.
 *
 * ⚠️ Data no passado é AVISO, não erro (a mesma regra da renegociação): boleto atrasado que
 * chega junto com a mercadoria é justamente o caso mais urgente de registrar.
 */
export function conferirPagamentoDoPapel(parcelas: readonly ParcelaDoPapel[], totalNota: number): ConferenciaDePagamento {
  const erros: string[] = []
  if (!parcelas.length) return { ok: true, erros, soma: 0 } // ⭐ vazio = "a definir", caminho legítimo

  parcelas.forEach((p, i) => {
    if (!(p.valor > 0)) erros.push(`A parcela ${i + 1} está sem valor.`)
    if (!p.dVenc || Number.isNaN(p.dVenc.getTime())) erros.push(`A parcela ${i + 1} está sem data.`)
  })
  const soma = r2(parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0))
  const dif = r2(soma - r2(totalNota))
  if (Math.abs(dif) > CENTAVO) {
    erros.push(
      `As parcelas somam R$ ${soma.toFixed(2)} e a nota é R$ ${r2(totalNota).toFixed(2)} `
      + `(${dif > 0 ? 'sobra' : 'falta'} R$ ${Math.abs(dif).toFixed(2)}).`,
    )
  }
  return { ok: erros.length === 0, erros, soma }
}
