// ⭐⭐⭐ A FONTE ÚNICA DE SUGESTÃO DE VÍNCULO (07/09/2026) — decisão do dono.
//
// *"QUALQUER lugar que categoriza linha de banco (import, pendentes, edição de
// transação) roda o MESMO matcher e oferece as MESMAS opções — fonte única de
// sugestão."*
//
// ⛔⛔ O QUE ESTAVA ERRADO, MEDIDO EM PROD (Caçula, 07/09):
//
//  1. **O matcher só andava num sentido.** Ele nasce de uma LINHA DO EXTRATO e
//     procura conta a pagar. A ex-payable do Cancian (R$ 230,81 da NF 834771,
//     marcada como paga e sem vínculo) fica em Pendentes pedindo categoria — e
//     como ela NÃO é linha de extrato, ninguém nunca procurou par pra ela.
//     Aqui os dois sentidos usam a MESMA função e o MESMO texto de motivo.
//
//  2. **O fornecedor valia 15 pontos que quase nunca eram pagos.** Medido:
//     **90 de 6.750 linhas OFX têm `supplierId`** (1,3%). O critério existia e
//     era letra morta em 98,7% dos casos. O nome do fornecedor está na
//     DESCRIÇÃO ("CARLOS CANCIAN CIA LTDA - Pagamento"), não numa FK — então é
//     de lá que ele sai. ⚠️ Resolver por nome é **sugestão**, nunca gravação:
//     o `supplierId` da transação não é tocado por este módulo.
//
//     O efeito medido no caso real: o par Cancian (linha 232,81 de 31/08 × conta
//     230,81 venc 29/08, nome 87%, R$ 2,00 de juros) marcava **65 pontos =
//     NO_MATCH** — abaixo do corte de 70, **invisível**. Com o fornecedor
//     resolvido pelo nome ele passa dos 70 e vira sugestão com motivo escrito.
//
//  3. **"Não é isso" não existia.** Recusar era um gesto sem memória: a mesma
//     sugestão voltava no próximo carregamento. Aqui a recusa é um par gravado
//     (`ParRecusado`) e o filtro é do módulo, não da tela — recusar na Conciliação
//     cala a sugestão nos Pendentes também.
//
// ⛔ RÉGUA DE HONESTIDADE (a regra do dono): **a sugestão SEMPRE vem com o motivo
// visível e NUNCA vincula sozinha.** Este módulo não escreve nada — ele descreve.

import { jaroWinkler } from './jaro-winkler'
import { normalizeForMatch } from './normalize-for-match'
import { scoreMatch, type MatchCandidate, type OFXTransaction, type MatchReason } from './match'

// ────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────

/** Um lado do par. A linha do extrato e a conta a pagar têm a MESMA forma —
 *  é isso que deixa o motor rodar nos dois sentidos sem duplicar régua. */
export interface LadoDoPar {
  id: string
  descricao: string
  /** sempre positivo */
  valor: number
  /** extrato: a data do lançamento · conta: o vencimento */
  data: Date
  tipo: 'CREDIT' | 'DEBIT'
  /** FK quando existe; quase sempre null nas linhas de extrato (medido: 1,3%) */
  fornecedorId: string | null
  /** só o extrato tem conta bancária */
  contaBancariaId: string | null
}

export type GrauDeConfianca = 'alta' | 'media' | 'baixa'

export interface SugestaoDeVinculo {
  extratoId: string
  contaId: string
  score: number
  confianca: GrauDeConfianca
  /** as chaves estáveis (viram chips na tela) */
  motivos: MatchReason[]
  /** ⛔ a frase que a tela é OBRIGADA a mostrar — sugestão sem motivo não existe */
  porQue: string
  /** diferença extrato − conta. Positivo = pagou mais (juros/tarifa). */
  diferenca: number
  /** o fornecedor foi reconhecido pelo NOME (não pela FK)? */
  fornecedorPeloNome: string | null
}

/** Um par que o dono já recusou — "não é isso". */
export interface ParRecusado {
  extratoId: string
  contaId: string
}

export interface FornecedorConhecido {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
}

// ────────────────────────────────────────────────────────────────
// Réguas
// ────────────────────────────────────────────────────────────────

/** ⛔ o corte de EXIBIÇÃO. Abaixo disso a tela não mostra — e o dono não é
 *  incomodado com palpite. Igual ao CONFIRM_THRESHOLD histórico. */
export const CORTE_PRA_SUGERIR = 70
/** acima disso o card nasce em verde (mas ainda com DOIS botões — nunca sozinho) */
export const CORTE_DE_ALTA = 90

/** o nome do fornecedor bate com a descrição da linha? */
const CORTE_DE_NOME = 0.82

/**
 * ⭐⭐ VALOR EXATO DENTRO DESTA JANELA APARECE MESMO ABAIXO DO CORTE (09/09/2026).
 *
 * **O caso do dono:** *"contabilidade R$ 1.621,00 · di car R$ 1.000,00 — o valor exato
 * existe no extrato. Por que não sugeriu?"*
 *
 * **A conta do score explica:** 50 (valor exato) + 5 (pago 4-7 dias depois do vencimento)
 * + 0 (a conta lançada à mão não tem fornecedor cadastrado) + 0 (o nome que ele digitou,
 * "contabilidade", não parece com "I. V. S. LTDA") = **55 pontos, abaixo do corte de 70.**
 * Invisível — e pagar cinco dias depois do vencimento é o mais normal do mundo.
 *
 * ⛔ A régua NÃO é "baixar o corte": isso deixaria entrar valor PRÓXIMO, que é palpite.
 * **Valor exato é o sinal mais forte deste domínio** e a janela curta é o que impede a
 * coincidência de virar sugestão. O score real fica como está, então o par nasce em
 * confiança BAIXA e ranqueado abaixo dos fortes — aparece, mas sem se fingir de certeza.
 *
 * ⚠️ MEDIDO EM PROD ANTES DE LIGAR: na Caçula isso acrescenta **2 pares, os dois que o
 * dono nomeou, com ZERO conta ganhando mais de uma opção**. Em empresa com muitos valores
 * redondos iguais na mesma semana pode haver disputa — e aí a tela já diz *"mais de um
 * pagamento parecido pra esta conta"* em vez de escolher por conta própria.
 */
export const DIAS_PRO_VALOR_EXATO_APARECER = 7

export function grauDeConfianca(score: number): GrauDeConfianca {
  if (score >= CORTE_DE_ALTA) return 'alta'
  if (score >= CORTE_PRA_SUGERIR) return 'media'
  return 'baixa'
}

/**
 * Acha o fornecedor cujo nome aparece na descrição da linha.
 *
 * ⚠️ Só devolve quando há **um** vencedor claro. Empate técnico devolve null:
 * "heurística nunca decide quem é" — é a mesma disciplina do pareamento de
 * transferência, e aqui ela vale porque o fornecedor vale 15 pontos.
 */
export function reconhecerFornecedor(
  descricao: string,
  fornecedores: FornecedorConhecido[],
): FornecedorConhecido | null {
  const alvo = normalizeForMatch(descricao)
  if (!alvo) return null

  let melhor: { f: FornecedorConhecido; sim: number } | null = null
  let segundo = 0
  for (const f of fornecedores) {
    const sim = Math.max(
      jaroWinkler(alvo, normalizeForMatch(f.razaoSocial)),
      f.nomeFantasia ? jaroWinkler(alvo, normalizeForMatch(f.nomeFantasia)) : 0,
    )
    if (!melhor || sim > melhor.sim) { segundo = melhor?.sim ?? 0; melhor = { f, sim } }
    else if (sim > segundo) segundo = sim
  }
  if (!melhor || melhor.sim < CORTE_DE_NOME) return null
  // ⛔ dois fornecedores igualmente parecidos = não sei qual é. Devolver um
  // deles seria dar 15 pontos a um palpite.
  if (melhor.sim - segundo < 0.03) return null
  return melhor.f
}

/** a frase do "porquê", montada dos MESMOS dados que geraram o score */
export function frasePorQue(
  extrato: LadoDoPar,
  conta: LadoDoPar,
  motivos: MatchReason[],
  fornecedorPeloNome: string | null,
): string {
  const partes: string[] = []
  if (motivos.includes('VALOR_EXATO')) partes.push('valor exato')
  else if (motivos.includes('VALOR_PROXIMO_1PCT')) partes.push(`valor com ${brl(Math.abs(extrato.valor - conta.valor))} de diferença`)
  else if (motivos.includes('VALOR_PROXIMO_5PCT')) partes.push(`valor com ${brl(Math.abs(extrato.valor - conta.valor))} de diferença`)

  const dias = Math.round((extrato.data.getTime() - conta.data.getTime()) / 86400000)
  if (dias === 0) partes.push('pago no dia do vencimento')
  else if (dias > 0) partes.push(`pago ${dias} dia${dias > 1 ? 's' : ''} depois do vencimento`)
  else partes.push(`pago ${-dias} dia${dias < -1 ? 's' : ''} antes de vencer`)

  if (fornecedorPeloNome) partes.push(`o nome no extrato é ${fornecedorPeloNome}`)
  else if (motivos.includes('FORNECEDOR_IGUAL')) partes.push('mesmo fornecedor')
  else if (motivos.includes('DESC_MUITO_SIMILAR')) partes.push('nome muito parecido')
  else if (motivos.includes('DESC_SIMILAR')) partes.push('nome parecido')

  return partes.join(' · ')
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ────────────────────────────────────────────────────────────────
// O motor — PURO, os dois sentidos
// ────────────────────────────────────────────────────────────────

export interface EntradaDeSugestao {
  /** a linha do extrato (EFFECTED, veio do banco) */
  extrato: LadoDoPar
  /** as contas a pagar/receber candidatas */
  contas: LadoDoPar[]
  /** os fornecedores da empresa, pra reconhecer o nome na descrição */
  fornecedores: FornecedorConhecido[]
  /** os pares que o dono já recusou */
  recusados?: ParRecusado[]
  /** corte de exibição (default CORTE_PRA_SUGERIR) */
  corte?: number
}

/**
 * Sugere vínculos pra UMA linha de extrato. Ordena por score desc.
 *
 * ⛔ Não decide nada: devolve a lista com o motivo escrito e para por aí.
 */
export function sugerirVinculos(entrada: EntradaDeSugestao): SugestaoDeVinculo[] {
  const corte = entrada.corte ?? CORTE_PRA_SUGERIR
  const recusados = new Set((entrada.recusados ?? []).map((r) => `${r.extratoId}|${r.contaId}`))

  // ⭐ O PULO DO GATO: o fornecedor sai da DESCRIÇÃO quando a FK está vazia —
  // e ela está vazia em 98,7% das linhas de extrato (medido).
  const reconhecido = entrada.extrato.fornecedorId
    ? null
    : reconhecerFornecedor(entrada.extrato.descricao, entrada.fornecedores)
  const fornecedorDoExtrato = entrada.extrato.fornecedorId ?? reconhecido?.id ?? null

  const ofx: OFXTransaction = {
    id: entrada.extrato.id,
    description: entrada.extrato.descricao,
    amount: entrada.extrato.valor,
    type: entrada.extrato.tipo,
    date: entrada.extrato.data,
    supplierId: fornecedorDoExtrato,
    bankAccountId: entrada.extrato.contaBancariaId ?? '',
  }

  const out: SugestaoDeVinculo[] = []
  for (const c of entrada.contas) {
    if (recusados.has(`${entrada.extrato.id}|${c.id}`)) continue
    const cand: MatchCandidate = {
      id: c.id,
      lifecycle: c.tipo === 'DEBIT' ? 'PAYABLE' : 'RECEIVABLE',
      description: c.descricao,
      amount: c.valor,
      dueDate: c.data,
      supplierId: c.fornecedorId,
      customerId: null,
      categoryId: null,
    }
    const s = scoreMatch(ofx, cand)
    if (!s) continue
    // ⭐ o valor exato numa janela curta passa por cima do corte — ver a nota em
    // `DIAS_PRO_VALOR_EXATO_APARECER`. O score NÃO é inflado: ele só deixa de ser filtro.
    const diasDoPar = Math.abs(Math.round(
      (entrada.extrato.data.getTime() - c.data.getTime()) / 86400000))
    const exatoEPerto = s.reasons.includes('VALOR_EXATO')
      && diasDoPar <= DIAS_PRO_VALOR_EXATO_APARECER
    if (s.score < corte && !exatoEPerto) continue
    // ⚠️ o nome do fornecedor só entra na frase se ele REALMENTE contou —
    // dizer "o nome no extrato é X" quando o X não pontuou seria motivo falso.
    const contou = s.reasons.includes('FORNECEDOR_IGUAL') && !!reconhecido
    out.push({
      extratoId: entrada.extrato.id,
      contaId: c.id,
      score: s.score,
      confianca: grauDeConfianca(s.score),
      motivos: s.reasons,
      porQue: frasePorQue(entrada.extrato, c, s.reasons, contou ? (reconhecido!.nomeFantasia ?? reconhecido!.razaoSocial) : null),
      diferenca: Math.round((entrada.extrato.valor - c.valor) * 100) / 100,
      fornecedorPeloNome: contou ? (reconhecido!.nomeFantasia ?? reconhecido!.razaoSocial) : null,
    })
  }
  return out.sort((a, b) => b.score - a.score)
}

/**
 * O SENTIDO INVERSO: sugere linhas de extrato pra UMA conta a pagar.
 *
 * ⛔⛔ É a metade que não existia, e é ela que resolve o caso do dono: a conta a
 * pagar (ou a ex-payable já marcada como paga e sem vínculo) fica na tela
 * pedindo classificação, e ninguém nunca procurou o pagamento dela no extrato.
 *
 * ⚠️ Reusa `sugerirVinculos` linha a linha — **a mesma régua, a mesma frase**.
 * Escrever um ranker próprio aqui seria criar a segunda derivação que a lição do
 * B1 diz que sempre diverge no primeiro caso de borda.
 */
export function sugerirVinculosDaConta(entrada: {
  conta: LadoDoPar
  extratos: LadoDoPar[]
  fornecedores: FornecedorConhecido[]
  recusados?: ParRecusado[]
  corte?: number
}): SugestaoDeVinculo[] {
  const out: SugestaoDeVinculo[] = []
  for (const e of entrada.extratos) {
    out.push(...sugerirVinculos({
      extrato: e,
      contas: [entrada.conta],
      fornecedores: entrada.fornecedores,
      recusados: entrada.recusados,
      corte: entrada.corte,
    }))
  }
  return out.sort((a, b) => b.score - a.score)
}
