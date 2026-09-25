// ⭐⭐⭐ NOTA SEM VENCIMENTO → CONTA A PAGAR (13/09/2026) — o gesto que zera as 21.
//
// **A história, nas palavras do dono:** *"no começo a conferência não tinha onde pôr
// vencimento; notas entraram só como estoque."* O **F5** conta o estrago desde 03/09:
// **21 notas · R$ 8.588,75** que passaram pelo estoque e nunca chegaram ao Contas a Pagar.
//
// **O caso que fechou a conta:** a linha da stone de **R$ 2.843,35 (08/09)** paga **6 notas**
// da MARIA LUIZA — 2 com conta (1.486,50) e **4 SEM conta** (463,74 · 326,69 · 235,16 ·
// 331,28 = **1.356,87**). A diferença que o card não fechava era **exatamente as 4
// invisíveis**.
//
// ⚠️⚠️ **E ISTO NÃO É UM MOTOR NOVO — é um ORQUESTRADOR de dois que já existem.**
//   · `salvarCombinado` (29/08) grava as parcelas **e** refaz a fila de sugestão na mesma
//     transação — é o dono de *"o que a gente combinou pagar"*;
//   · `enviarParaContasPagar` (24/08) é a ÚNICA porta que cria conta no financeiro.
// Escrever a gravação aqui seria a segunda porta — a doença que o `@@unique` do
// `stock_payable_link` existe pra recusar.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import type { AuthContext } from '@/lib/auth/rbac'
import { combinadoDaNota, salvarCombinado, validarCombinado, numeroRenegociado, CombinadoError } from './combinado'
import { enviarParaContasPagar } from '../ponte-contas-pagar'

export class DefinirParcelasError extends Error {}

export interface ParcelaDigitada { valor: number; dVenc: string }

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface PreviewDefinir {
  nfeId: string
  nNF: string | null
  fornecedor: string | null
  totalNota: number
  soma: number
  diferenca: number
  /** ⚠️ a soma pode divergir e ainda estar certa — boleto traz juros embutido */
  fechaComANota: boolean
  exigeMotivo: boolean
  erros: string[]
  avisos: string[]
  /** quantas contas a pagar NASCEM se confirmar */
  contasQueNascem: number
  podeGravar: boolean
  /** ⛔ a nota já tem parcela com data: este gesto é pra quem NÃO tem */
  jaTemParcelas: boolean
}

/**
 * ⭐ O PREVIEW — mostra a conta antes de gravar, como todo gesto de dinheiro desta casa.
 *
 * ⚠️ A validação é a MESMA do combinado (`validarCombinado`): soma que não fecha **avisa e
 * pede motivo**, nunca trava em silêncio. Travar empurraria o dono a lançar a conta por
 * fora — exatamente o que produziu estas 21.
 */
export async function previewDefinirParcelas(
  companyId: string,
  nfeId: string,
  parcelas: ParcelaDigitada[],
  motivo: string | null,
  db: PrismaClient = defaultPrisma,
): Promise<PreviewDefinir> {
  const nota = await db.stockNfe.findFirst({
    where: { id: nfeId, companyId },
    select: { chave: true, vNF: true, emitNome: true },
  })
  if (!nota) throw new DefinirParcelasError('Nota não encontrada nesta empresa.')

  const atual = await combinadoDaNota(companyId, nfeId, db)
  const propostas = parcelas.map((p, i) => ({
    numero: numeroRenegociado(i), valor: r2(Number(p.valor)), dVenc: p.dVenc, origem: 'RENEGOCIADO' as const,
  }))
  const v = validarCombinado({ parcelas: propostas, totalNota: atual?.totalNota ?? r2(nota.vNF ?? 0), motivo, hoje: new Date() })

  return {
    nfeId,
    nNF: nota.chave.slice(25, 34).replace(/^0+/, '') || null,
    fornecedor: nota.emitNome,
    totalNota: v.totalNota,
    soma: v.soma,
    diferenca: v.diferenca,
    fechaComANota: v.fechaComANota,
    exigeMotivo: v.exigeMotivo,
    erros: v.erros,
    avisos: v.avisos,
    contasQueNascem: propostas.length,
    podeGravar: v.podeGravar,
    jaTemParcelas: (atual?.parcelas.length ?? 0) > 0,
  }
}

export interface ResultadoDefinir {
  parcelasGravadas: number
  contasCriadas: number
  fornecedoresCadastrados: number
  valorTotal: number
  /** ⚠️ erro por parcela, com o motivo — envio parcial NUNCA falha em silêncio */
  erros: { suggestionId: string; motivo: string }[]
}

/**
 * ⭐⭐ DEFINE AS PARCELAS **E** CRIA AS CONTAS — o gesto do dono, num clique só.
 *
 * ⛔ **É `stock.manage` na rota**, e continua sendo: criar conta a pagar é obrigação
 * financeira (a fronteira de 24/08 — *"boleto é obrigação, coisa minha"*). O que muda é
 * que antes **não havia gesto nenhum**, e a nota ficava invisível pra sempre.
 *
 * ⚠️ **Duas transações, de propósito, e o estado do meio é VISÍVEL:** se a gravação das
 * parcelas passar e o envio falhar, a nota fica com parcelas datadas **na fila de envio**
 * (`fila-envio.ts`, o card de Recebimentos) — que é um estado legítimo e à vista, não um
 * buraco. Enfiar o envio dentro da transação do combinado faria um fornecedor recusado
 * apagar as parcelas que o dono acabou de digitar.
 */
export async function definirParcelasEEnviar(
  input: {
    companyId: string
    nfeId: string
    parcelas: ParcelaDigitada[]
    motivo?: string | null
    /** aceite explícito pra cadastrar o fornecedor no financeiro (dado do XML da SEFAZ) */
    cadastrarFornecedores: boolean
    ctx: AuthContext
    userId: string
  },
  db: PrismaClient = defaultPrisma,
): Promise<ResultadoDefinir> {
  if (!input.parcelas.length) throw new DefinirParcelasError('Digite ao menos uma parcela.')

  // ⛔ nota que JÁ tem parcela com data não passa por aqui: trocar o combinado de uma nota
  // já definida é RENEGOCIAR, e isso tem gesto próprio (com o histórico e o cancelamento
  // das contas antigas). Dois caminhos pro mesmo fato divergiriam no primeiro caso de borda.
  const atual = await combinadoDaNota(input.companyId, input.nfeId, db)
  if (atual && atual.parcelas.length > 0) {
    throw new DefinirParcelasError(
      'Esta nota já tem parcelas definidas — pra mudar, use "Ajustar parcelas (renegociou?)".',
    )
  }

  try {
    await salvarCombinado(
      { companyId: input.companyId, nfeId: input.nfeId, parcelas: input.parcelas, motivo: input.motivo ?? null, userId: input.userId },
      db,
    )
  } catch (e) {
    // ⚠️ a mensagem do combinado já é acionável ("a soma não fecha — escreva um motivo")
    if (e instanceof CombinadoError) throw new DefinirParcelasError(e.message)
    throw e
  }

  // as sugestões que a gravação acabou de criar — **não enviadas ainda**
  const jaEnviadas = new Set((await db.stockPayableLink.findMany({
    where: { companyId: input.companyId, origem: 'NFE', refId: input.nfeId },
    select: { suggestionId: true },
  })).map((l) => l.suggestionId).filter(Boolean) as string[])
  const sugestoes = await db.stockPayableSuggestion.findMany({
    where: { companyId: input.companyId, nfeId: input.nfeId, dVenc: { not: null } },
    select: { id: true },
  })
  const aEnviar = sugestoes.filter((s) => !jaEnviadas.has(s.id)).map((s) => s.id)

  const envio = await enviarParaContasPagar(
    { companyId: input.companyId, suggestionIds: aEnviar, cadastrarFornecedores: input.cadastrarFornecedores, ctx: input.ctx, userId: input.userId },
    db,
  )

  return {
    parcelasGravadas: input.parcelas.length,
    contasCriadas: envio.criadas,
    fornecedoresCadastrados: envio.fornecedoresCadastrados,
    valorTotal: r2(envio.valorTotal),
    erros: envio.erros,
  }
}

/**
 * ⭐ A FILA DAS QUE FALTAM — o F5 **e o F3** virando TELA.
 *
 * ⚠️ Ela nasce da MESMA pergunta do invariante (sugestão não enviada), pra o e-mail
 * noturno e a tela nunca contarem números diferentes. **E-mail noturno não é lugar de
 * dívida vencendo — o dono lê TELA** (a lição dos R$ 21.968,02 de 30/08).
 *
 * ⛔ Em 13/09 isto valeu só pro **F5** (sem data). O **F3** (conferida, COM data, nunca
 * enviada) ficou sem tela por 11 dias — e o único caso que apareceu, o do IVAN, venceu
 * nesse meio-tempo. **A mesma fila responde os dois**, porque a pergunta é uma: *o que
 * falta ir pro financeiro?*
 */
export interface NotaSemVencimento {
  nfeId: string
  nNF: string | null
  chave: string
  fornecedor: string | null
  total: number
  entrouEm: Date
  /** ⚠️ quantas linhas a nota tem esperando data — quase sempre 1 (a do total) */
  parcelas: number
  /** ⭐ pra onde a linha LEVA: o recibo, onde mora o gesto. Fila que não abre o gesto
   *  é a "porta sem maçaneta" do outro lado — o dono vê o trabalho e não alcança ele. */
  conferenceId: string | null
  /**
   * ⭐⭐ 24/09 — **O VENCIMENTO, QUANDO ELE JÁ EXISTE.**
   *
   * ⛔⛔ A fila do F5 ganhou tela em 13/09 com esta lição escrita no arquivo (*"e-mail
   * noturno não é lugar de dívida vencendo — o dono lê TELA"*) — e **o F3 nunca ganhou**.
   * Resultado: o boleto do IVAN (R$ 326,50, venceu 14/09) passou **10 dias** com o F3
   * gritando todo dia e **nenhuma tela mostrando**. É o episódio de 30/08 se repetindo
   * exatamente onde o comentário avisava.
   *
   * ⚠️ `null` = precisa COMBINAR a data (o trabalho do F5). Com data = **só falta MANDAR**,
   * e são gestos diferentes: um abre o recibo, o outro é um clique.
   */
  dVenc: Date | null
  /** ⭐ as sugestões desta nota — é o que o POST `/estoque/contas-a-pagar` recebe */
  suggestionIds: string[]
}

export async function notasSemVencimento(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<NotaSemVencimento[]> {
  const semData = await db.stockPayableSuggestion.findMany({
    where: { companyId },
    select: { id: true, nfeId: true, chave: true, supplierNome: true, valor: true, criadoEm: true, dVenc: true },
    orderBy: [{ dVenc: 'asc' }, { criadoEm: 'asc' }],
  })
  if (!semData.length) return []

  // ⚠️ enviada sem data não existe (a ponte recusa), mas a checagem fica: o dia em que
  // alguém abrir uma segunda porta de envio, esta fila não vai cobrar trabalho já feito.
  const enviadas = new Set((await db.stockPayableLink.findMany({
    where: { companyId, suggestionId: { in: semData.map((s) => s.id) } },
    select: { suggestionId: true },
  })).map((l) => l.suggestionId))

  const porNota = new Map<string, NotaSemVencimento>()
  for (const s of semData) {
    if (enviadas.has(s.id)) continue
    const j = porNota.get(s.nfeId)
    if (j) { j.total = r2(j.total + s.valor); j.parcelas++; j.suggestionIds.push(s.id); continue }
    porNota.set(s.nfeId, {
      nfeId: s.nfeId,
      nNF: s.chave.slice(25, 34).replace(/^0+/, '') || null,
      chave: s.chave,
      fornecedor: s.supplierNome,
      total: r2(s.valor),
      entrouEm: s.criadoEm,
      parcelas: 1,
      conferenceId: null,
      dVenc: s.dVenc,
      suggestionIds: [s.id],
    })
  }
  const notas = [...porNota.values()]

  // ⚠️ uma consulta só, não uma por nota — a fila abre junto com a tela de Recebimentos
  const confs = await db.stockReceiptConference.findMany({
    where: { companyId, nfeId: { in: notas.map((n) => n.nfeId) } },
    select: { id: true, nfeId: true },
  })
  const porNfe = new Map(confs.map((c) => [c.nfeId, c.id]))
  for (const n of notas) n.conferenceId = porNfe.get(n.nfeId) ?? null
  return notas
}

/** a frase do card — o número e o dinheiro juntos, porque é o dinheiro que move o dono */
export const fraseDaFila = (notas: NotaSemVencimento[]) =>
  `${notas.length} nota${notas.length > 1 ? 's' : ''} sem vencimento · ${brl(r2(notas.reduce((a, n) => a + n.total, 0)))}`
