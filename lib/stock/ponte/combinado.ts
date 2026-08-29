// ⭐⭐ O COMBINADO ≠ A NOTA (29/08/2026) — renegociação pós-nota.
//
// CASO REAL (BOX PAPER, R$ 10.400,66): a NF-e traz 3 duplicatas de ~3.466. O dono falou
// com o fornecedor, os 3 boletos foram CANCELADOS e vieram 4 novos. **A nota não muda —
// é da SEFAZ, assinada. O que mudou foi o combinado.** Até aqui a conferência só sabia
// COPIAR as duplicatas do XML, então o financeiro ficava cobrando um acordo que não
// existe mais.
//
// ⚠️ NENHUM DOS DOIS SOBRESCREVE O OUTRO — é a regra do módulo inteiro (a mesma do
// "itens digitados do DANFE não apagam o XML" e do "categoria é decisão do dono"):
//   · `stock_nfe_dup`            → o que a NOTA diz  (3 parcelas, imutável, da SEFAZ)
//   · `stock_parcela_combinada`  → o que foi COMBINADO (4 parcelas, decisão do dono)
// Os dois ficam visíveis na tela. Inventar que a nota tem 4 duplicatas seria mentir sobre
// um documento fiscal assinado.
//
// ⚠️ VALIDAÇÃO AVISA, NÃO TRAVA: renegociação tem desconto e tem juros — a soma DIVERGIR
// do total da nota é um evento legítimo do mundo real, não um erro de digitação. O que o
// sistema exige quando diverge é um MOTIVO CURTO, pra o "por quê" ficar gravado junto do
// número. Travar aqui empurraria o dono pra lançar por fora, que é o pior dos mundos.
// (Trava só o que impede o Contas a Pagar de existir: valor ≤ 0, vencimento ausente,
// número repetido, lista vazia.)

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export class CombinadoError extends Error {}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const CENTAVO = 0.01
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => d.toISOString().slice(0, 10)

export type OrigemParcela = 'XML' | 'RENEGOCIADO'

export interface ParcelaCombinada {
  numero: string
  valor: number
  /** ISO 'YYYY-MM-DD' ou Date — o Contas a Pagar EXIGE vencimento */
  dVenc: string | Date
  origem?: OrigemParcela
}

export interface ValidacaoCombinado {
  /** impedem gravar (o Contas a Pagar não existiria) */
  erros: string[]
  /** não impedem — o dono decide (com motivo, quando a soma foge) */
  avisos: string[]
  soma: number
  totalNota: number
  diferenca: number
  fechaComANota: boolean
  /** true → o dono precisa escrever um motivo curto pra gravar */
  exigeMotivo: boolean
  podeGravar: boolean
}

/**
 * PURA. Valida a lista editada contra o total da nota.
 * @param motivo texto curto que o dono escreveu (quando a soma diverge)
 */
export function validarCombinado(input: {
  parcelas: ParcelaCombinada[]
  totalNota: number
  motivo?: string | null
  /** só pra avisar "vencimento no passado" — nunca decide nada */
  hoje?: Date
}): ValidacaoCombinado {
  const erros: string[] = []
  const avisos: string[] = []
  const { parcelas, totalNota } = input

  if (parcelas.length === 0) erros.push('A lista está vazia — uma nota a prazo precisa de pelo menos uma parcela.')

  const numeros = new Set<string>()
  for (const [i, p] of parcelas.entries()) {
    const rotulo = p.numero?.trim() ? `parcela ${p.numero}` : `parcela ${i + 1}`
    if (!p.numero?.trim()) erros.push(`A ${rotulo} está sem número.`)
    else if (numeros.has(p.numero.trim())) erros.push(`O número "${p.numero.trim()}" está repetido — cada parcela precisa do seu.`)
    else numeros.add(p.numero.trim())

    if (!(p.valor > 0)) erros.push(`A ${rotulo} está sem valor.`)
    const d = p.dVenc ? new Date(p.dVenc) : null
    if (!d || Number.isNaN(d.getTime())) {
      erros.push(`A ${rotulo} está sem vencimento — o Contas a Pagar precisa da data.`)
    } else if (input.hoje && dia(d) < dia(input.hoje)) {
      // ⚠️ AVISO, não erro: boleto renegociado pode mesmo já ter vencido (o dono está
      // regularizando atraso). Travar aqui impediria justamente o caso mais urgente.
      avisos.push(`A ${rotulo} vence ${dia(d).split('-').reverse().join('/')}, que já passou — confira se é isso mesmo.`)
    }
  }

  const soma = round2(parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0))
  const diferenca = round2(soma - round2(totalNota))
  const fechaComANota = Math.abs(diferenca) <= CENTAVO
  const exigeMotivo = !fechaComANota && parcelas.length > 0

  if (!fechaComANota && parcelas.length > 0) {
    avisos.push(
      `A soma das parcelas (${brl(soma)}) ${diferenca > 0 ? 'passa' : 'fica abaixo'} do total da nota ` +
        `(${brl(round2(totalNota))}) em ${brl(Math.abs(diferenca))}. ` +
        `Isso acontece em renegociação (desconto, juros, acréscimo) — se for o caso, escreva o motivo e siga.`,
    )
  }
  if (exigeMotivo && !input.motivo?.trim()) {
    erros.push('A soma não fecha com a nota — escreva um motivo curto (ex.: "juros da renegociação") pra ficar gravado.')
  }

  return {
    erros, avisos, soma, totalNota: round2(totalNota), diferenca, fechaComANota, exigeMotivo,
    podeGravar: erros.length === 0,
  }
}

// ---------------------------------------------------------------------------
// O RESOLVEDOR ÚNICO — "quais parcelas valem HOJE pra esta nota?"
// ---------------------------------------------------------------------------
//
// ⚠️ REGRA 4: esta é a ÚNICA função que responde isso. A conferência, a ponte, a tela de
// boletos e o juiz F chamam ELA. Uma segunda leitura (ex: alguém voltar a ler `duplicatas`
// direto) faria a tela e a gravação discordarem — a doença dos 7 detectores de par.

export interface CombinadoDaNota {
  /** o que a NOTA diz — cru da SEFAZ, nunca editado */
  xml: Array<{ numero: string; valor: number; dVenc: Date | null }>
  /** o que vale hoje pro financeiro */
  parcelas: Array<{ numero: string; valor: number; dVenc: Date; origem: OrigemParcela }>
  /** houve renegociação? */
  renegociado: boolean
  motivo: string | null
  totalNota: number
  somaCombinado: number
  fechaComANota: boolean
}

export async function combinadoDaNota(
  companyId: string,
  nfeId: string,
  db: Db = defaultPrisma,
): Promise<CombinadoDaNota | null> {
  const nota = await db.stockNfe.findFirst({ where: { id: nfeId, companyId }, select: { id: true, vNF: true } })
  if (!nota) return null

  const dups = await db.stockNfeDup.findMany({ where: { companyId, nfeId }, orderBy: { dVenc: 'asc' } })
  const xml = dups.map((d, i) => ({ numero: d.nDup ?? String(i + 1).padStart(3, '0'), valor: d.vDup, dVenc: d.dVenc }))

  const combinadas = await db.stockParcelaCombinada.findMany({
    where: { companyId, origemDoc: 'NFE', refId: nfeId, ativo: true },
    orderBy: { dVenc: 'asc' },
  })

  const parcelas = combinadas.length
    ? combinadas.map((c) => ({ numero: c.numero, valor: c.valor, dVenc: c.dVenc, origem: c.origem as OrigemParcela }))
    : xml
        .filter((x): x is { numero: string; valor: number; dVenc: Date } => x.dVenc !== null)
        .map((x) => ({ ...x, origem: 'XML' as const }))

  const totalNota = round2(nota.vNF ?? 0)
  const somaCombinado = round2(parcelas.reduce((s, p) => s + p.valor, 0))
  return {
    xml,
    parcelas,
    renegociado: combinadas.some((c) => c.origem === 'RENEGOCIADO'),
    motivo: combinadas.find((c) => c.motivo)?.motivo ?? null,
    totalNota,
    somaCombinado,
    fechaComANota: Math.abs(round2(somaCombinado - totalNota)) <= CENTAVO,
  }
}

// ---------------------------------------------------------------------------
// GRAVAR O COMBINADO NOVO
// ---------------------------------------------------------------------------

/** numeração própria das renegociadas: R01, R02… — nunca colide com o '001' do XML,
 *  e é o que mantém o UNIQUE do `stock_payable_link` funcionando quando a nota já teve
 *  parcelas enviadas (a mesma nota pode ter mandado '001' antes e mandar 'R01' agora). */
export const numeroRenegociado = (i: number) => `R${String(i + 1).padStart(2, '0')}`

export interface SalvarCombinadoInput {
  companyId: string
  nfeId: string
  parcelas: Array<{ valor: number; dVenc: string | Date }>
  motivo?: string | null
  userId?: string | null
}

export async function salvarCombinado(
  input: SalvarCombinadoInput,
  db: PrismaClient = defaultPrisma,
): Promise<{ parcelas: number; renegociacaoId: string; validacao: ValidacaoCombinado }> {
  const atual = await combinadoDaNota(input.companyId, input.nfeId, db)
  if (!atual) throw new CombinadoError('Nota não encontrada nesta empresa.')

  const propostas: ParcelaCombinada[] = input.parcelas.map((p, i) => ({
    numero: numeroRenegociado(i),
    valor: round2(Number(p.valor)),
    dVenc: p.dVenc,
    origem: 'RENEGOCIADO',
  }))
  const validacao = validarCombinado({
    parcelas: propostas,
    totalNota: atual.totalNota,
    motivo: input.motivo,
    hoje: new Date(),
  })
  if (!validacao.podeGravar) throw new CombinadoError(validacao.erros.join(' '))

  const renegociacaoId = novaRenegociacaoId()
  await db.$transaction((tx) => gravarCombinadoNaTx(tx, input.companyId, input.nfeId, propostas, input.motivo ?? null, renegociacaoId, input.userId ?? null))
  return { parcelas: propostas.length, renegociacaoId, validacao }
}

export const novaRenegociacaoId = () =>
  `rng_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/**
 * O miolo da gravação, SEM abrir transação — pra quem já está dentro de uma.
 *
 * ⚠️ Existe separado por causa do item "renegociar DEPOIS de enviado": lá é preciso
 * apagar as contas a pagar antigas E gravar o combinado novo no MESMO gesto. Se fossem
 * duas transações, uma falha no meio deixaria o dono sem as contas velhas e sem as novas
 * — o estado pela metade que a atomicidade das marcações acabou de eliminar no import.
 */
export async function gravarCombinadoNaTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  nfeId: string,
  propostas: ParcelaCombinada[],
  motivo: string | null,
  renegociacaoId: string,
  userId: string | null,
): Promise<void> {
  {
    // ⚠️ as anteriores viram INATIVAS, não são apagadas — o histórico das renegociações
    // é o rastro que responde "o que a gente tinha combinado antes?".
    await tx.stockParcelaCombinada.updateMany({
      where: { companyId: companyId, origemDoc: 'NFE', refId: nfeId, ativo: true },
      data: { ativo: false },
    })
    await tx.stockParcelaCombinada.createMany({
      data: propostas.map((p) => ({
        companyId: companyId, origemDoc: 'NFE', refId: nfeId,
        numero: p.numero, valor: p.valor, dVenc: new Date(p.dVenc), origem: 'RENEGOCIADO',
        motivo: motivo?.trim() || null, renegociacaoId, criadoPorId: userId,
      })),
    })

    // ⭐ A FILA DE TRABALHO ANDA JUNTO, NA MESMA TRANSAÇÃO.
    // `stock_payable_suggestion` é a fila do que falta mandar pro financeiro. Se ela
    // continuasse com as 3 do XML, a tela mostraria um combinado e mandaria outro — dois
    // lugares respondendo a mesma pergunta, que é a doença que este módulo mais paga.
    // ⚠️ Só as NÃO ENVIADAS são substituídas: parcela que já virou conta a pagar sai pelo
    // caminho do item 3 (cancelar a conta), nunca por baixo do pano.
    const jaEnviadas = await tx.stockPayableLink.findMany({
      where: { companyId: companyId, origem: 'NFE', refId: nfeId },
      select: { suggestionId: true },
    })
    const idsEnviados = new Set(jaEnviadas.map((l) => l.suggestionId).filter(Boolean) as string[])
    const sugestoes = await tx.stockPayableSuggestion.findMany({
      where: { companyId: companyId, nfeId: nfeId },
      select: { id: true, chave: true, supplierCnpj: true, supplierNome: true },
    })
    const modelo = sugestoes[0]
    const pendentes = sugestoes.filter((s) => !idsEnviados.has(s.id))
    if (pendentes.length) {
      await tx.stockPayableSuggestion.deleteMany({ where: { id: { in: pendentes.map((s) => s.id) } } })
    }
    if (modelo) {
      await tx.stockPayableSuggestion.createMany({
        data: propostas.map((p) => ({
          companyId: companyId, nfeId: nfeId, chave: modelo.chave,
          supplierCnpj: modelo.supplierCnpj, supplierNome: modelo.supplierNome,
          nDup: p.numero, dVenc: new Date(p.dVenc), valor: p.valor, status: 'SUGERIDA',
        })),
      })
    }
  }
}
