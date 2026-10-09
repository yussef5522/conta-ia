/**
 * ⭐⭐⭐ REGISTRAR DEVOLUÇÃO DE MÚTUO FLEXÍVEL — a porta que faltava (09/10/2026).
 *
 * ⛔⛔ **O DEFEITO QUE A CRIOU, nas palavras do dono:** *"paguei 40.000 ao Arafat hoje PELO
 * COFRE e a tela não tem porta: o «Marcar paga» só concilia débito de extrato com valor ±R$ 1
 * e janela ±7d do vencimento — régua de BANCO que não serve pra mútuo de cofre com valor
 * livre."*
 *
 * ⚠️ E ele está certo em cheio: a janela bancária (`installment-match.ts`) existe pra casar
 * **parcela de banco**, onde o valor é conhecido e o débito cai perto do vencimento. No mútuo
 * flexível **o valor é livre** (40k · 50k · 50k nas três devoluções reais) e **a data é a do
 * caixa**, não a da agenda — então aquela régua devolve lista VAZIA por construção, e o dono
 * fica olhando um botão que nunca acha nada.
 *
 * ═══ ⭐ O QUE ESTA PORTA FAZ (e o que ela NÃO faz) ═══
 *
 * UM clique cria a **TRANSAÇÃO de saída** e o **VÍNCULO ao contrato** na MESMA transação de
 * banco. ⛔⛔ **Atomicidade não é detalhe aqui — é a cicatriz de ontem:** em 09/10 a recusa do
 * retalho rodava DEPOIS do `create` da ordem e deixou um lote fantasma em PLANEJADA; a
 * contabilidade de escrita da prova pegou (531 → 532). Aqui **toda checagem roda ANTES** de
 * qualquer escrita, e o que grava está num `$transaction` só: ou sai a saída COM o vínculo,
 * ou não sai nada.
 *
 * ⛔ **E O VÍNCULO PASSA PELA PORTA ÚNICA** (`vincularPagamentoDeParcela`, 11/09): ela soma
 * TODOS os vínculos, grava o split e carimba a data — escrever o vínculo aqui à mão seria a
 * segunda porta que o trigger `loan_installment_no_double_link` existe pra recusar.
 *
 * ⚠️ **O SPLIT DE 0% É O QUE FAZ A DEVOLUÇÃO PARCIAL FUNCIONAR.** `computeLinkSplit` com
 * `rateMonthly === 0` devolve `isPartial: false` e `amortization = pago` — então devolver
 * 40.000 numa referência nominal de 41.428,57 **conta inteiro no saldo** (240.000 → 200.000)
 * em vez de ficar PARTIAL e invisível pro `saldoDevedorAtual`. É a regra de 06/08 (*"empréstimo
 * 0% — encargo SEMPRE zero"*) pagando dividendo num caso que ela não previa.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { TOL, arredondar2 } from './estado-da-parcela'

type Db = PrismaClient | Prisma.TransactionClient

export class DevolucaoError extends Error {
  code: string
  constructor(code: string, msg: string) {
    super(msg)
    this.code = code
    this.name = 'DevolucaoError'
  }
}

/**
 * ⚠️ A JANELA DA BUSCA É DE DIAS, NÃO DE VENCIMENTO — e a diferença é o ponto deste arquivo.
 *
 * Aqui a pergunta é *"eu já lancei esta saída na mão?"*, então o que importa é a **proximidade
 * da data informada** (o dono lança hoje e registra hoje ou amanhã). ⛔ 10 dias de propósito:
 * folga pra o lançamento de ontem, e **curto o bastante pra não alcançar a devolução do mês
 * anterior** — as devoluções reais estão ~30 dias uma da outra, então uma janela larga ofereceria
 * a devolução de setembro como candidata da de outubro.
 */
export const JANELA_DA_BUSCA_DIAS = 10

/** ⚠️ o mesmo degrau `FECHA` do resto da casa — 2 centavos é ruído de arredondamento */
const MESMO_VALOR = TOL

/** uma saída que já está no extrato e PODE ser esta devolução */
export interface SaidaCandidata {
  id: string
  data: Date
  valor: number
  descricao: string
  origem: string
  /** quantos dias de distância da data informada (sinal: negativo = antes) */
  diasDeDistancia: number
  /** ⚠️ casar NÃO recategoriza: se a saída já tem categoria, ela fica como o dono deixou */
  temCategoria: boolean
  categoriaNome: string | null
}

/** a referência da agenda nominal onde o vínculo vai cair */
export interface ReferenciaDaDevolucao {
  id: string
  number: number
  dueDate: Date
  payment: number
}

/**
 * ⭐ A ALOCAÇÃO: **a próxima referência ABERTA por ORDEM** — exatamente como as 3 primeiras
 * devoluções caíram (#1 · #2 · #3).
 *
 * ⚠️ E ela **não tenta ser esperta com a data**: no flexível a agenda é referência e a
 * alocação é arbitrária por natureza (a lei de 07/10 nasceu disso — julho e agosto nem TÊM
 * referência, porque a agenda começa em setembro). Escolher a referência "do mês do
 * pagamento" seria inventar uma correspondência que o contrato não tem, e **o selo do mês já
 * é imune à ordem do vínculo** desde aquele dia.
 */
export function proximaReferenciaAberta<T extends { id: string; number: number; dueDate: Date; payment: number; status: string }>(
  installments: readonly T[],
): ReferenciaDaDevolucao | null {
  const aberta = [...installments]
    .sort((a, b) => a.number - b.number)
    .find((i) => i.status !== 'PAID')
  if (!aberta) return null
  return { id: aberta.id, number: aberta.number, dueDate: aberta.dueDate, payment: aberta.payment }
}

/**
 * ⭐ O NOME CURTO DO CREDOR, pra a descrição não ficar com o cadastro inteiro dentro.
 * `"Arafat (arafet thalji)"` → `"Arafat"`. ⚠️ Sem parêntese, devolve o nome como está —
 * cortar por tamanho truncaria nome legítimo.
 */
export function nomeCurtoDoCredor(lender: string): string {
  const i = lender.indexOf('(')
  const curto = (i > 0 ? lender.slice(0, i) : lender).trim()
  return curto || lender.trim()
}

/**
 * ⭐ A DESCRIÇÃO AUTOMÁTICA, no formato que o dono pediu: *"Devolução de mútuo — Arafat
 * (4ª devolução)"*.
 *
 * ⚠️ O N conta **DEVOLUÇÕES**, não o número da referência — e no flexível os dois divergem
 * assim que uma devolução não cobre o nominal. A devolução é o fato; a referência é a prateleira
 * onde ela foi encostada.
 */
export function descricaoDaDevolucao(lender: string, nDevolucao: number): string {
  return `Devolução de mútuo — ${nomeCurtoDoCredor(lender)} (${nDevolucao}ª devolução)`
}

/**
 * ⭐⭐ A BUSCA DA SAÍDA QUE JÁ EXISTE — *"nunca duas saídas pro mesmo pagamento"* (ordem do dono).
 *
 * ⛔ Ela olha as DUAS portas de vínculo (1:1 e N:1): uma saída já amarrada a outra parcela
 * **não é candidata**, e checar só uma delas foi literalmente o bug de 14/08 (8 parcelas
 * passaram por "órfãs" estando linkadas pela N:1).
 *
 * ⚠️ E ela NÃO filtra por origem. A tentação é exigir `MANUAL` (o cofre é dinheiro, só entra
 * à mão) — mas no dia em que a devolução sair por PIX de uma conta bancária, a saída chega
 * pelo EXTRATO, e um filtro de origem faria a busca não achar **justamente a linha que já
 * está lá**, criando a segunda saída que esta função existe pra impedir.
 */
export async function procurarSaidaSemVinculo(
  db: Db,
  input: { bankAccountId: string; valor: number; data: Date; janelaDias?: number },
): Promise<SaidaCandidata[]> {
  const dias = input.janelaDias ?? JANELA_DA_BUSCA_DIAS
  const ms = dias * 86_400_000
  const achadas = await (db as PrismaClient).transaction.findMany({
    where: {
      bankAccountId: input.bankAccountId,
      type: 'DEBIT',
      amount: { gte: input.valor - MESMO_VALOR, lte: input.valor + MESMO_VALOR },
      date: { gte: new Date(input.data.getTime() - ms), lte: new Date(input.data.getTime() + ms) },
      loanInstallmentPaid: { is: null },
      loanInstallmentPayments: { none: {} },
    },
    select: {
      id: true, date: true, amount: true, description: true, origin: true,
      category: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 10,
  })
  return achadas.map((t) => ({
    id: t.id,
    data: t.date,
    valor: t.amount,
    descricao: t.description,
    origem: t.origin,
    diasDeDistancia: Math.round((t.date.getTime() - input.data.getTime()) / 86_400_000),
    temCategoria: !!t.category,
    categoriaNome: t.category?.name?.trim() ?? null,
  }))
}

/**
 * ⭐ A FRASE DO QUE VAI ACONTECER — curta, com o número, antes do clique.
 */
export function fraseDoQueVaiAcontecer(acao: 'CASAR' | 'CRIAR', valor: number, conta: string): string {
  const brl = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return acao === 'CASAR'
    ? `vincula a saída de ${brl} que já está em ${conta} — nenhuma saída nova`
    : `cria a saída de ${brl} em ${conta} e vincula ao contrato, no mesmo gesto`
}

export interface DevolucoesDoContrato {
  /** quantas devoluções já existem (as duas portas de vínculo) */
  quantas: number
  totalDevolvido: number
}

/**
 * ⭐⭐ QUANTO JÁ FOI DEVOLVIDO — lido dos VÍNCULOS, nunca de um campo gravado.
 *
 * ⚠️ Lê as duas portas pelo mesmo motivo de sempre (14/08), e **não há dupla contagem**: o
 * trigger do banco torna impossível uma parcela ter as duas.
 */
export function devolucoesDoContrato(
  installments: readonly {
    reconciledTransaction?: { amount: number } | null
    payments?: readonly { amount: number }[] | null
  }[],
): DevolucoesDoContrato {
  let quantas = 0
  let total = 0
  for (const i of installments) {
    if (i.reconciledTransaction) {
      quantas += 1
      total += i.reconciledTransaction.amount
    }
    for (const p of i.payments ?? []) {
      quantas += 1
      total += p.amount
    }
  }
  return { quantas, totalDevolvido: arredondar2(total) }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ⭐ O GESTO — prévia e gravação, com a MESMA régua nas duas pontas
// ═══════════════════════════════════════════════════════════════════════════════════

export interface EntradaDaDevolucao {
  companyId: string
  loanId: string
  valor: number
  /** data do fato (default: hoje, resolvido pelo chamador — o relógio nunca decide aqui) */
  data: Date
  /** descrição; ausente = a automática */
  descricao?: string
  /** a saída que JÁ existe e o dono escolheu casar */
  casarComTransactionId?: string
  /**
   * ⛔ o escape explícito pra o caso *"é OUTRA saída, cria mesmo"* — sem ele, achar candidata
   * e criar uma segunda é IMPOSSÍVEL (é a trava do "nunca duas saídas pro mesmo pagamento").
   */
  criarMesmoComCandidata?: boolean
  /** a categoria escolhida na tela; ausente = a que o dono já usou nas devoluções anteriores */
  categoryId?: string | null
  userId?: string | null
}

export interface PreviaDaDevolucao {
  contrato: { id: string; lender: string; contractNumber: string | null; principal: number }
  conta: { id: string; nome: string }
  referencia: ReferenciaDaDevolucao
  valor: number
  data: string
  descricao: string
  nDevolucao: number
  candidatos: SaidaCandidata[]
  acao: 'CASAR' | 'CRIAR'
  frase: string
  /** ⭐ a categoria que a devolução vai levar — lida da decisão anterior do dono */
  categoria: { id: string; nome: string } | null
  categoriasPossiveis: Array<{ id: string; nome: string }>
  /** `true` quando falta a categoria e o gesto vai recusar — a tela cobra ANTES do clique */
  pedeCategoria: boolean
  /** ⭐ o efeito no contrato, calculado pela MESMA aritmética que a tela mostra depois */
  depois: { devolucoes: number; totalDevolvido: number; saldo: number }
  avisos: string[]
}

/** o que o `select` precisa trazer pra a prévia e pra a gravação — um lugar só */
const INCLUDE_DO_CONTRATO = {
  bankAccount: { select: { id: true, name: true, accountType: true, balance: true, allowNegativeBalance: true, creditLimit: true } },
  installments: {
    orderBy: { number: 'asc' as const },
    select: {
      id: true, number: true, dueDate: true, payment: true, status: true,
      reconciledTransaction: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  },
} as const

async function carregarContrato(db: Db, companyId: string, loanId: string) {
  const loan = await (db as PrismaClient).loan.findFirst({
    where: { id: loanId, companyId },
    include: INCLUDE_DO_CONTRATO,
  })
  if (!loan) throw new DevolucaoError('NAO_ENCONTRADO', 'Empréstimo não encontrado nesta empresa')
  /**
   * ⛔⛔ A PORTA É SÓ DO FLEXÍVEL, e a trava é do SERVIDOR — não do botão escondido.
   *
   * Em contrato de banco a devolução não existe como gesto: a parcela é debitada pelo banco e
   * aparece no extrato, e quem casa isso é a janela bancária. Deixar esta porta aberta ali
   * criaria uma saída MANUAL pro lado de uma linha de extrato que vai chegar — o mesmo dinheiro
   * duas vezes.
   */
  if (loan.scheduleSource !== 'FLEXIBLE') {
    throw new DevolucaoError(
      'NAO_E_FLEXIVEL',
      'Esta porta é só pro mútuo flexível. Em contrato de banco a parcela é debitada pelo banco e ' +
        'aparece no extrato — ali o caminho é o «Marcar paga», que casa o débito com a parcela.',
    )
  }
  /**
   * ⛔ MÚTUO SEM CONTA NÃO TEM ONDE A SAÍDA NASCER — e a recusa ENSINA a saída.
   *
   * ⚠️ E ela protege de um buraco real: `vincularPagamentoDeParcela` filtra por
   * `bankAccountId: loan.bankAccountId ?? undefined`, e `undefined` num `where` do Prisma
   * **REMOVE o filtro** — a trava de conta viraria porta aberta (a classe que o
   * `exige-conta.ts` documenta desde 01/09).
   */
  if (!loan.bankAccountId || !loan.bankAccount) {
    throw new DevolucaoError(
      'SEM_CONTA',
      'Este mútuo não tem conta definida (foi pago direto pelo mutuante). ' +
        'Defina a conta de onde a devolução sai, no cadastro do contrato, e o gesto passa a existir.',
    )
  }
  /**
   * ⚠️ O ESTREITAMENTO VIAJA NO TIPO, não só no `if`. Devolver o `loan` cru faria cada
   * call-site re-checar `bankAccount` com `!` — e `!` é onde o contrato incompleto se esconde
   * (a cicatriz do `as never` de 20/09). Com a conta separada e NÃO-nula, passar `null` adiante
   * deixa de compilar.
   */
  return { loan, conta: loan.bankAccount, bankAccountId: loan.bankAccountId }
}

/** ⚠️ `valor` vem da tela: o guard do número mora aqui, não num `if` da rota */
function exigirValor(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new DevolucaoError('VALOR_INVALIDO', 'A devolução precisa de um valor maior que zero.')
  }
  return arredondar2(valor)
}

export async function previaDaDevolucao(db: Db, input: EntradaDaDevolucao): Promise<PreviaDaDevolucao> {
  const { loan, conta, bankAccountId } = await carregarContrato(db, input.companyId, input.loanId)
  const valor = exigirValor(input.valor)

  const referencia = proximaReferenciaAberta(loan.installments)
  if (!referencia) {
    throw new DevolucaoError(
      'SEM_REFERENCIA',
      'A agenda nominal deste contrato não tem referência aberta. ' +
        'Acrescente referências à agenda antes de registrar a devolução.',
    )
  }

  const ja = devolucoesDoContrato(loan.installments)
  const nDevolucao = ja.quantas + 1
  const descricao = (input.descricao ?? '').trim() || descricaoDaDevolucao(loan.lender, nDevolucao)

  const candidatos = await procurarSaidaSemVinculo(db, {
    bankAccountId,
    valor,
    data: input.data,
  })

  const escolhida = input.casarComTransactionId
    ? candidatos.find((c) => c.id === input.casarComTransactionId)
    : undefined
  if (input.casarComTransactionId && !escolhida) {
    throw new DevolucaoError(
      'CANDIDATA_INVALIDA',
      'A saída escolhida não está mais disponível pra casar (pode ter sido vinculada enquanto você decidia).',
    )
  }

  const acao: 'CASAR' | 'CRIAR' = escolhida ? 'CASAR' : 'CRIAR'
  const avisos: string[] = []
  if (acao === 'CRIAR' && candidatos.length > 0) {
    avisos.push(
      candidatos.length === 1
        ? `já existe uma saída de ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${conta.name.trim()} nesta janela — ` +
          'vincule ela em vez de criar outra, ou diga que é uma saída diferente'
        : `existem ${candidatos.length} saídas desse valor em ${conta.name.trim()} nesta janela — escolha qual é esta devolução`,
    )
  }
  /**
   * ⚠️ A SEPARAÇÃO DE PAPÉIS NA SOMA: o `depois` usa o valor DA DEVOLUÇÃO, e no 0% ele é
   * exatamente o que vai pra `amortization` (o split de 0% devolve `amortization = pago`).
   * Recalcular por outra fórmula aqui faria a prévia prometer um saldo e o ledger gravar outro.
   */
  const totalDepois = arredondar2(ja.totalDevolvido + valor)
  const depois = {
    devolucoes: nDevolucao,
    totalDevolvido: totalDepois,
    saldo: arredondar2(loan.principal - totalDepois),
  }

  const cat = await categoriaDaDevolucao(db, { companyId: input.companyId, loanId: input.loanId })
  const categoria = input.categoryId
    ? (cat.opcoes.find((o) => o.id === input.categoryId) ?? cat.sugerida)
    : cat.sugerida
  /**
   * ⛔⛔ CATEGORIA FALTANDO É COBRADA NA PRÉVIA, nunca depois do clique — *"fazer o dono
   * clicar pra levar um não é trabalho que dava pra poupar"* (a régua do seletor da caixa).
   * ⚠️ Quando a saída já existe e JÁ tem categoria, não há o que cobrar: casar não recategoriza.
   */
  const candidataJaTemCategoria = acao === 'CASAR' && !!escolhida?.temCategoria
  if (!categoria && !candidataJaTemCategoria) {
    avisos.push(
      'falta dizer a categoria desta devolução — sem ela a saída nasce em «A CLASSIFICAR» ' +
        'e não entra como baixa de passivo',
    )
  }

  return {
    contrato: {
      id: loan.id, lender: loan.lender, contractNumber: loan.contractNumber, principal: loan.principal,
    },
    conta: { id: conta.id, nome: conta.name.trim() },
    referencia,
    valor,
    data: input.data.toISOString(),
    descricao,
    nDevolucao,
    candidatos,
    acao,
    frase: fraseDoQueVaiAcontecer(acao, valor, conta.name.trim()),
    categoria,
    categoriasPossiveis: cat.opcoes,
    pedeCategoria: !categoria && !candidataJaTemCategoria,
    depois,
    avisos,
  }
}

/**
 * ⭐⭐ A CATEGORIA SAI DA DECISÃO QUE O DONO JÁ TOMOU — nunca de um `if (nome === …)`.
 *
 * Ela é lida das devoluções ANTERIORES deste contrato (a mais usada). É o desenho do seed dos
 * encargos de 04/09: *"não é o sistema escolhendo categoria, é o sistema repetindo a decisão
 * dele"*. ⚠️ E resolver por NOME cravado seria a cicatriz da conta `'sicredi '` em roupa nova.
 *
 * ⛔⛔ E ISTO FECHA UM DEFEITO REAL, medido em prod: a devolução de 01/09 (R$ 50.000) está
 * **SEM CATEGORIA** enquanto as de jul/ago têm *"Amortização de Mútuo (terceiros)"*. Efeito: as
 * duas primeiras saem do Fluxo de Caixa (categoria `TRANSFERENCIA`) e a terceira entra no SAIU
 * como *"A CLASSIFICAR"* — **o mesmo fato contado de dois jeitos**, porque aquele vínculo foi
 * feito por um caminho que não tinha esta régua.
 */
export async function categoriaDaDevolucao(
  db: Db,
  input: { companyId: string; loanId: string },
): Promise<{ sugerida: { id: string; nome: string } | null; opcoes: Array<{ id: string; nome: string }> }> {
  const anteriores = await (db as PrismaClient).transaction.findMany({
    where: {
      OR: [
        { loanInstallmentPaid: { loanId: input.loanId } },
        { loanInstallmentPayments: { some: { installment: { loanId: input.loanId } } } },
      ],
      categoryId: { not: null },
    },
    select: { categoryId: true, category: { select: { id: true, name: true } } },
  })
  const contagem = new Map<string, { id: string; nome: string; n: number }>()
  for (const t of anteriores) {
    if (!t.category) continue
    const atual = contagem.get(t.category.id)
    contagem.set(t.category.id, { id: t.category.id, nome: t.category.name.trim(), n: (atual?.n ?? 0) + 1 })
  }
  const maisUsada = [...contagem.values()].sort((a, b) => b.n - a.n)[0] ?? null

  /**
   * ⚠️ As OPÇÕES são as de `TRANSFERENCIA` de propósito: devolução de mútuo **não é despesa**
   * (é baixa de passivo), e oferecer despesa aqui convidaria a jogar 40 mil no DRE.
   */
  const opcoes = await (db as PrismaClient).category.findMany({
    where: { companyId: input.companyId, isActive: true, dreGroup: 'TRANSFERENCIA' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  const lista = opcoes.map((c) => ({ id: c.id, nome: c.name.trim() }))
  /**
   * ⭐⭐ QUANDO A RESPOSTA É ÚNICA, O SISTEMA RESOLVE — e isso o TESTE me ensinou (09/10).
   *
   * ⛔ A 1ª versão exigia histórico, e contrato **sem devolução anterior** ficava travado
   * pedindo pra escolher numa lista de **UM item** — a parede que esta casa já pagou na
   * categoria de entrada da ponte (13/09): *"liberdade só onde há variação real; onde a
   * resposta é única, o sistema fixa"*.
   *
   * ⚠️ E a trava continua inteira com DUAS ou mais: aí é *"não sei qual"*, e o dono decide —
   * a mesma régua do empate do PAO DE MEL.
   */
  const sugerida = maisUsada
    ? { id: maisUsada.id, nome: maisUsada.nome }
    : lista.length === 1
      ? lista[0]
      : null
  return { sugerida, opcoes: lista }
}

export interface DevolucaoGravada {
  transactionId: string
  criouSaida: boolean
  referencia: number
  valor: number
  totalDevolvido: number
  saldo: number
  nDevolucao: number
  descricao: string
}

/**
 * ⭐⭐⭐ A GRAVAÇÃO — e a ORDEM das linhas aqui É a feature.
 *
 * ⛔⛔ **TODA CHECAGEM ANTES DE QUALQUER ESCRITA.** A cicatriz é de ontem (09/10): a recusa do
 * retalho rodava DEPOIS do `create` da ordem, a rota devolvia 422 e **a ordem ficava gravada**
 * — recusa com estado pela metade, o pior dos dois mundos. Quem pegou foi a contabilidade de
 * escrita da prova (531 → 532 ordens), não uma asserção minha.
 *
 * ⭐ Então: contrato · valor · referência · candidata · categoria · saldo — **tudo conferido
 * fora** da transação; dentro dela só o que grava, e num commit só.
 */
export async function registrarDevolucao(
  db: PrismaClient,
  input: EntradaDaDevolucao,
): Promise<DevolucaoGravada> {
  // ─── 1. as checagens, ANTES de escrever uma linha ───
  const previa = await previaDaDevolucao(db, input)
  const { loan, conta, bankAccountId } = await carregarContrato(db, input.companyId, input.loanId)
  const valor = previa.valor

  /**
   * ⛔⛔ A TRAVA DO "NUNCA DUAS SAÍDAS PRO MESMO PAGAMENTO" — e **quem recusa é o SERVIDOR**.
   *
   * ⚠️ Esconder o botão na tela não impede a chamada (a régua do FREIO da contagem, 23/08): a
   * rota pode ser chamada por script, por cliente copiado ou por tela em cache, e aí nasce a
   * segunda saída do mesmo dinheiro — que é exatamente o que o dono pediu pra ser impossível.
   * O escape existe (`criarMesmoComCandidata`), porque duas saídas iguais no mesmo dia existem
   * no mundo real; o que não existe é criá-la **sem decidir**.
   */
  if (previa.acao === 'CRIAR' && previa.candidatos.length > 0 && !input.criarMesmoComCandidata) {
    throw new DevolucaoError(
      'SAIDA_JA_EXISTE',
      previa.candidatos.length === 1
        ? `Já existe uma saída de ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ` +
          `${previa.conta.nome} nesta janela («${previa.candidatos[0].descricao}»). ` +
          'Vincule ela em vez de criar outra — ou confirme que esta é uma saída diferente.'
        : `Existem ${previa.candidatos.length} saídas desse valor em ${previa.conta.nome} nesta janela. ` +
          'Escolha qual é esta devolução — ou confirme que esta é uma saída diferente.',
    )
  }

  const casar = previa.acao === 'CASAR'
  const categoryId = previa.categoria?.id ?? null
  if (!categoryId && !(casar && previa.candidatos.find((c) => c.id === input.casarComTransactionId)?.temCategoria)) {
    throw new DevolucaoError(
      'SEM_CATEGORIA',
      'Diga a categoria desta devolução. Ela não é despesa — é baixa de passivo —, então a lista ' +
        'oferecida é a de transferência. Sem categoria a saída nasce em «A CLASSIFICAR».',
    )
  }

  /**
   * ⚠️ O FREIO DE SALDO É O MESMO DA PORTA MANUAL (`checkBalance`) — e roda ANTES. Deixar o
   * `$transaction` estourar nele seria rollback em vez de recusa, com a mesma mensagem crua
   * que o dono não entende.
   */
  if (!casar) {
    const { checkBalance, BalanceCheckError } = await import('@/lib/balance/check')
    const r = checkBalance({
      currentBalance: conta.balance,
      allowNegativeBalance: conta.allowNegativeBalance,
      creditLimit: conta.creditLimit,
      amountChange: -valor,
      accountName: conta.name,
    })
    if (!r.allowed) throw new BalanceCheckError(r)
  }

  const { vincularPagamentoDeParcela } = await import('./vincular-pagamento')
  const { reAncorarContas } = await import('@/lib/balance/recalcular')

  // ─── 2. o que grava, num commit só ───
  const gravado = await db.$transaction(async (tx) => {
    let transactionId: string | undefined = input.casarComTransactionId
    let criouSaida = false

    if (!transactionId) {
      const criada = await tx.transaction.create({
        data: {
          bankAccountId,
          categoryId,
          date: input.data,
          description: previa.descricao,
          amount: valor,
          type: 'DEBIT',
          /**
           * ⚠️ A ESCADA DE STATUS da casa (28/06): conta CASH nasce RECONCILED, e com categoria
           * também. O cofre é as duas coisas — então deixar `PENDING` poria a devolução na fila
           * de classificação de uma linha que já nasceu classificada.
           */
          status: conta.accountType === 'CASH' || categoryId ? 'RECONCILED' : 'PENDING',
          origin: 'MANUAL',
        },
        select: { id: true },
      })
      transactionId = criada.id
      criouSaida = true
    }

    /**
     * ⭐ O VÍNCULO PELA PORTA ÚNICA. Ela soma TODOS os vínculos da referência, grava o split
     * (no 0% o `amortization` passa a ser o valor devolvido) e carimba a data pelo MAIOR
     * instante — tudo que uma escrita à mão aqui teria que lembrar de fazer.
     */
    await vincularPagamentoDeParcela({
      db: tx,
      companyId: input.companyId,
      loanId: input.loanId,
      installmentNumber: previa.referencia.number,
      transactionIds: [transactionId],
    })

    /** ⚠️ saldo DERIVADO no MESMO commit — a lei de 30/09; `increment` aqui era o drift */
    await reAncorarContas(tx, [bankAccountId])

    return { transactionId, criouSaida }
  })

  return {
    transactionId: gravado.transactionId,
    criouSaida: gravado.criouSaida,
    referencia: previa.referencia.number,
    valor,
    totalDevolvido: previa.depois.totalDevolvido,
    saldo: previa.depois.saldo,
    nDevolucao: previa.nDevolucao,
    descricao: previa.descricao,
  }
}
