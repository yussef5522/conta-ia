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
import { nomeDaContaBateComALinha } from './nome-da-conta-manual'
import { processadoraDaLinha, chaveDoPadrao, avisoDaProcessadora } from './processadora-de-boleto'

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
  /**
   * ⭐ quando a linha é de uma PROCESSADORA de boleto (PJBANK, PagSeguro…): o texto que a
   * tela mostra junto da sugestão. Ela não nomeia o beneficiário, e a oferta tem que dizer
   * isso — é palpite de VALOR, não de nome.
   */
  avisoDeProcessadora?: string | null
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
  /** ⭐ o CNPJ do cadastro — âncora mais forte que nome quando o boleto o carrega */
  cnpj?: string | null
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

/**
 * ⭐ o que o nome da conta MANUAL vale — o mesmo peso do `FORNECEDOR_IGUAL` (15), porque
 * responde a MESMA pergunta ("é essa pessoa?") por outro caminho. Dar menos faria o caso
 * do ELETROSUL continuar 5 pontos abaixo do corte; dar mais inflaria texto sobre FK.
 */
export const PONTOS_DO_NOME_MANUAL = 15

/** ⭐ o que vale um padrão de processadora JÁ confirmado pelo dono — abaixo do nome, porque
 *  é memória de hábito, não identidade. */
export const PONTOS_DO_PADRAO_APRENDIDO = 10

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
/**
 * ⛔⛔ O NOME NORMALIZADO DO FORNECEDOR, CALCULADO UMA VEZ (10/09/2026) — vale 1,7 s.
 *
 * `normalizeForMatch(f.razaoSocial)` estava DENTRO do laço: a cada chamada, os 79
 * fornecedores eram normalizados de novo. Como o motor de lote chama isto uma vez por
 * LINHA da janela (~1.300), davam **~200 mil normalizações** por consulta — medido em
 * prod: `lotesDaFila` custava **2.179 ms**, e o badge do menu (a cada 60 s) passou a
 * pagar isso quando eu o liguei nessa função.
 *
 * ⚠️ `WeakMap` pela IDENTIDADE do objeto: os fornecedores são recriados a cada request,
 * então a memória morre com eles — nada de cache que envelhece entre requisições. E
 * `normalizeForMatch` é pura, então o resultado é **idêntico**, não aproximado.
 */
const nomesNormalizados = new WeakMap<FornecedorConhecido, { razao: string; fantasia: string | null }>()
function nomesDe(f: FornecedorConhecido) {
  let n = nomesNormalizados.get(f)
  if (!n) {
    n = {
      razao: normalizeForMatch(f.razaoSocial),
      fantasia: f.nomeFantasia ? normalizeForMatch(f.nomeFantasia) : null,
    }
    nomesNormalizados.set(f, n)
  }
  return n
}

/** só os dígitos — CNPJ vem formatado no cadastro e cru no extrato */
const soDigitos = (x: string) => x.replace(/\D/g, '')

/**
 * ⭐⭐⭐ QUEM É O FORNECEDOR DESTA LINHA — e os IRMÃOS dele no cadastro.
 *
 * ⛔⛔ O ACHADO DE 10/09/2026: **11 fornecedores da Caçula estão cadastrados DUAS VEZES
 * com o nome IDÊNTICO** (Frigorífico Silva, Focatto, Doceoli, Tozzo, Nestlé…). A trava do
 * empate (*"dois fornecedores igualmente parecidos = não sei qual é"*) devolvia **NULL**
 * — e ela estava certa pro caso que a motivou (o homônimo *"MAURO IVAN LUNARDI (PAO DE
 * MEL)"*, 09/09), mas **não distingue duas coisas diferentes**:
 *
 *   • **ambiguidade real** — nomes DIFERENTES e parecidos → não sei quem é → NULL. Fica.
 *   • **duplicata de cadastro** — nome IDÊNTICO → sei exatamente QUEM é; a dúvida é só
 *     sobre em qual REGISTRO as contas dele foram parar. Isso não é palpite.
 *
 * **O estrago era dinheiro parado:** medido em prod, `FRIGORIFICO SILVA … - Pagamento`
 * (uma descrição que NOMEIA o fornecedor com todas as letras) não era reconhecida, e as
 * **6 contas em aberto dele (R$ 19.491,46)** não apareciam em card nenhum.
 *
 * ⭐ Por isso esta função devolve **todos os ids do mesmo nome**: o fornecedor é UM, e as
 * contas dele são as dos dois registros. Quem monta o card soma os dois.
 */
export function reconhecerFornecedorComIrmaos(
  descricao: string,
  fornecedores: FornecedorConhecido[],
): { fornecedor: FornecedorConhecido; ids: string[]; porCnpj: boolean } | null {
  /**
   * ⭐ O CNPJ MANDA — é âncora mais forte que nome (decisão do dono).
   *
   * ⚠️ Boleto costuma carregar o CNPJ do beneficiário (`LIQUIDACAO BOLETO- 00360305…`).
   * Quando ele está na descrição e bate com o cadastro, **não há semelhança envolvida**:
   * é identidade. ⛔ E CNPJ que aponta pra DOIS cadastros diferentes volta pra régua do
   * nome — dois CNPJs iguais em cadastros distintos é duplicata, não escolha.
   */
  const digitos = soDigitos(descricao)
  if (digitos.length >= 14) {
    const porCnpj = fornecedores.filter((f) => {
      const c = soDigitos(f.cnpj ?? '')
      return c.length === 14 && digitos.includes(c)
    })
    if (porCnpj.length) {
      return { fornecedor: porCnpj[0], ids: porCnpj.map((f) => f.id), porCnpj: true }
    }
  }

  const alvo = normalizeForMatch(descricao)
  if (!alvo) return null

  let melhor: { f: FornecedorConhecido; sim: number } | null = null
  let segundo: { f: FornecedorConhecido; sim: number } | null = null
  for (const f of fornecedores) {
    const n = nomesDe(f)
    const sim = Math.max(
      jaroWinkler(alvo, n.razao),
      n.fantasia ? jaroWinkler(alvo, n.fantasia) : 0,
    )
    if (!melhor || sim > melhor.sim) { segundo = melhor; melhor = { f, sim } }
    else if (!segundo || sim > segundo.sim) segundo = { f, sim }
  }
  if (!melhor || melhor.sim < CORTE_DE_NOME) return null

  // ⭐ os IRMÃOS: mesmo nome normalizado = o mesmo fornecedor, cadastrado N vezes
  const chave = chaveDoNome(melhor.f)
  const irmaos = fornecedores.filter((f) => chaveDoNome(f) === chave)

  // ⛔ empate com nome DIFERENTE continua sendo "não sei qual é" — a trava do PAO DE MEL
  if (segundo && melhor.sim - segundo.sim < 0.03 && chaveDoNome(segundo.f) !== chave) return null

  return { fornecedor: melhor.f, ids: irmaos.map((f) => f.id), porCnpj: false }
}

/**
 * ⭐⭐ O CANONIZADOR — mapeia CADA cadastro pro id do grupo de mesmo nome.
 *
 * ⛔ Sem isto, reconhecer o fornecedor não basta: as contas do Frigorífico estão no
 * registro A e a régua pode devolver o B (que tem ZERO contas) — e o card não nasce do
 * mesmo jeito. Canonizando os DOIS lados (linha e nota), as contas dos dois registros
 * viram as contas de um fornecedor só, que é o que eles são.
 *
 * ⚠️ Isto NÃO funde nada no banco — é leitura. Fundir cadastro é decisão do dono, e a
 * régua dura dele está no estoque desde 04/09 (*"fusão errada é pior que duplicata
 * visível"*).
 */
export function canonizadorDeFornecedor(
  fornecedores: FornecedorConhecido[],
): (id: string | null | undefined) => string | null {
  const canonPorChave = new Map<string, string>()
  const canonPorId = new Map<string, string>()
  for (const f of fornecedores) {
    const k = chaveDoNome(f)
    if (!canonPorChave.has(k)) canonPorChave.set(k, f.id)
    canonPorId.set(f.id, canonPorChave.get(k)!)
  }
  return (id) => (id ? canonPorId.get(id) ?? id : null)
}

/** ⚠️ a chave da identidade: nome normalizado, o mesmo dos dois campos do cadastro */
function chaveDoNome(f: FornecedorConhecido): string {
  return normalizeForMatch(f.nomeFantasia ?? f.razaoSocial)
}

/** ⚠️ casca fina — quem só quer "quem é" continua chamando isto (REGRA 4) */
export function reconhecerFornecedor(
  descricao: string,
  fornecedores: FornecedorConhecido[],
): FornecedorConhecido | null {
  return reconhecerFornecedorComIrmaos(descricao, fornecedores)?.fornecedor ?? null
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

  // ⭐ o nome da conta manual é o motivo mais explicativo que existe pra ela — vem primeiro
  if (motivos.includes('NOME_DA_CONTA_MANUAL') && fornecedorPeloNome) partes.push(`"${fornecedorPeloNome}" aparece nos dois`)
  else if (fornecedorPeloNome) partes.push(`o nome no extrato é ${fornecedorPeloNome}`)
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
  /**
   * ⭐ padrões de processadora JÁ CONFIRMADOS pelo dono (chave → vezes). Ver
   * `processadora-de-boleto.ts`: linha de intermediária não nomeia o beneficiário, então
   * sem isto o par do aluguel é invisível — e com a porta aberta pra todo mundo o
   * falso-amigo volta.
   */
  padroesDeProcessadora?: Map<string, number>
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

    /**
     * ⭐⭐⭐ A CONTA MANUAL TAMBÉM TEM NOME (11/09/2026) — ordem do dono.
     *
     * Conta sem FK de fornecedor nunca ganha os 15 do `FORNECEDOR_IGUAL`, e por isso
     * `ELETROSUL 143,03 × "eletrosul" 143,00` parava em **60** contra um corte de 70 —
     * faltando exatamente esses pontos, com o nome escrito nos dois lados.
     *
     * ⚠️ Só vale quando a conta NÃO tem fornecedor: com FK, quem manda é a FK, e dar os
     * pontos duas vezes inflaria o score de quem já estava certo.
     */
    const nomeBate = !c.fornecedorId
      ? nomeDaContaBateComALinha(c.descricao, entrada.extrato.descricao)
      : null
    const scoreFinal = nomeBate ? s.score + PONTOS_DO_NOME_MANUAL : s.score

    /**
     * ⛔⛔⛔ O GUARD DO FALSO-AMIGO (11/09/2026) — a trava que protege tudo o resto.
     *
     * **O caso real:** `aluguel caçula 5.234,00 × DOCEOLI 5.234,88` — 88 centavos de
     * diferença, mesmo dia, **70 pontos: passava**. E DOCEOLI não tem nada com aluguel.
     *
     * ⭐ **A âncora do nome vale TAMBÉM no quase-exato: diferença de centavos não compra
     * identidade.** Valor EXATO continua passando sozinho (é o sinal mais forte do
     * domínio, e a janela curta impede a coincidência); o quase-exato precisa de alguém
     * dizendo QUEM é — FK igual, nome reconhecido na descrição, ou o nome da conta manual.
     */
    const soParecido = !s.reasons.includes('VALOR_EXATO')
    const alguemDizQuemE = s.reasons.includes('FORNECEDOR_IGUAL')
      || s.reasons.includes('DESC_MUITO_SIMILAR')
      || !!nomeBate

    /**
     * ⭐⭐ A EXCEÇÃO NOMEADA DA PROCESSADORA (11/09) — e ela é estreita de propósito.
     *
     * `PJBANK PAGAMENTOS 2.222,88 × "aluguel escritorio" 2.222,81` (7 centavos): ninguém
     * pode dizer quem é o beneficiário porque **o banco não sabe** — ele vê a PJBANK.
     * ⛔ Só entra quem está na lista fechada, só com data MUITO perto, e **sempre com o
     * aviso na cara**: é palpite de VALOR, e a tela diz isso.
     */
    const proc = processadoraDaLinha(entrada.extrato.descricao)
    const jaVisto = proc ? (entrada.padroesDeProcessadora?.get(chaveDoPadrao(proc, c.descricao)) ?? 0) : 0
    const peloIntermediario = !!proc && (
      s.reasons.includes('DATA_MESMA') || s.reasons.includes('DATA_D1') || jaVisto > 0
    )

    if (soParecido && !alguemDizQuemE && !peloIntermediario) continue
    // ⭐ o valor exato numa janela curta passa por cima do corte — ver a nota em
    // `DIAS_PRO_VALOR_EXATO_APARECER`. O score NÃO é inflado: ele só deixa de ser filtro.
    const diasDoPar = Math.abs(Math.round(
      (entrada.extrato.data.getTime() - c.data.getTime()) / 86400000))
    const exatoEPerto = s.reasons.includes('VALOR_EXATO')
      && diasDoPar <= DIAS_PRO_VALOR_EXATO_APARECER
    /**
     * ⭐⭐ A PROCESSADORA PASSA PELO CORTE PELA MESMA PORTA DO VALOR EXATO (11/09) — e pelo
     * mesmo motivo: **o score real fica como está**, ele só deixa de ser filtro. `PJBANK ×
     * aluguel` vale 65 (valor quase exato + D±1) contra um corte de 70, e sem esta porta o
     * par que o dono nomeou seria invisível pra sempre.
     * ⛔ O que a torna segura não é o número: é o **aviso na cara** e o fato de que ela
     * nasce em confiança BAIXA, ranqueada abaixo de todo par que tem nome.
     */
    if (scoreFinal < corte && !exatoEPerto && !peloIntermediario) continue
    // ⚠️ o nome do fornecedor só entra na frase se ele REALMENTE contou —
    // dizer "o nome no extrato é X" quando o X não pontuou seria motivo falso.
    const contou = s.reasons.includes('FORNECEDOR_IGUAL') && !!reconhecido
    const motivos = nomeBate ? ([...s.reasons, 'NOME_DA_CONTA_MANUAL'] as MatchReason[]) : s.reasons
    // ⚠️ o padrão já confirmado vale pontos (deixa de ser palpite puro), mas NUNCA vira
    // "alta confiança" sozinho — conciliar continua sendo o clique dele.
    const comPadrao = jaVisto > 0 ? scoreFinal + PONTOS_DO_PADRAO_APRENDIDO : scoreFinal
    out.push({
      extratoId: entrada.extrato.id,
      contaId: c.id,
      score: comPadrao,
      confianca: grauDeConfianca(comPadrao),
      motivos,
      porQue: frasePorQue(entrada.extrato, c, motivos, contou ? (reconhecido!.nomeFantasia ?? reconhecido!.razaoSocial) : nomeBate ? nomeBate.palavra.toUpperCase() : null),
      diferenca: Math.round((entrada.extrato.valor - c.valor) * 100) / 100,
      fornecedorPeloNome: contou ? (reconhecido!.nomeFantasia ?? reconhecido!.razaoSocial) : null,
      // ⭐ o aviso vai JUNTO com a sugestão — quem lê a oferta lê a ressalva
      avisoDeProcessadora: proc ? avisoDaProcessadora(proc, jaVisto) : null,
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
