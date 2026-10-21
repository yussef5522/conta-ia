/**
 * ⭐⭐⭐ EQUIPAMENTO (IMOBILIZADO) — A PORTA ÚNICA (20/10/2026)
 *
 * Tudo que escreve ou lê equipamento passa por aqui. Dois motivos, e o segundo é o que
 * importa:
 *
 *  1. **ESCRITA (REGRA 4/5):** a exclusão mútua com os mapas de ITEM só é garantida se existir
 *     **um** lugar que grava. Dois caminhos (a conferência e, amanhã, a entrada manual)
 *     escrevendo cada um do seu jeito deixariam o mesmo (fornecedor, produto) dizendo *"é o
 *     item X"* num mapa e *"é máquina"* no outro.
 *
 *  2. **LEITURA — e aqui é o coração:** `linhasDeEquipamento` é a **RÉGUA ÚNICA** que o **E2**
 *     e o **E16** consomem. Ver o bloco abaixo.
 *
 * ═══ ⛔⛔⛔ POR QUE OS DOIS INVARIANTES QUEBRARIAM SEM ELA ═══
 *
 * Uma linha de equipamento é conferida (o dono recebeu a boleadora) e **não gera movimento**.
 * Isso rompe as duas contas que o módulo faz hoje:
 *
 *   **E2** conta `stock_conference_item` CRU × movimentos `ENTRADA_NF` vigentes
 *        → *"6 itens conferidos vs 5 movimentos"* ⛔ **todas as noites, num recebimento CERTO**
 *   **E16** soma `vProd` dos itens da nota × Σ`custoTotal` que entrou no estoque
 *        → a nota declara R$ 21.000 a mais do que entrou ⛔ **idem**
 *
 * ⚠️ **É a anatomia exata de 27/08**, escrita no próprio E2: *"invariante que conta LINHA em
 * ledger imutável envelhece mal — toda correção legítima vira alarme falso, e alarme falso é
 * pior que alarme nenhum"*. Lá foi o estorno; aqui é o equipamento.
 *
 * ⛔⛔ **E OS DOIS LEEM DAQUI, nunca dois `where` copiados.** Dois filtros divergiriam no
 * primeiro caso de borda (equipamento numa nota recusada, conferência estornada) — e aí um
 * invariante ficaria verde e o outro vermelho sobre o MESMO fato, que é o pior desfecho
 * possível pra quem lê o e-mail das 3h.
 *
 * ═══ ⚠️ E A PERGUNTA É SOBRE O FATO GRAVADO ═══
 *
 * A régua pergunta *"existe linha em `stock_equipamento` apontando pra esta linha da nota?"* —
 * **nunca** *"a conferência ficou sem `itemId`?"*. Inferir da ausência é a doença do
 * `?? 'CAIXA'` (20/09) e do `'categoryId' in t` (26/08): *ausência de dado virando estado*.
 */

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { normalizarBusca } from '@/lib/busca-texto'
import { DESTINO_EQUIPAMENTO, notaInteiraEhEquipamento, type DestinoDaLinha } from './destino-da-linha'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const soDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

export class EquipamentoError extends Error {}

// ---------------------------------------------------------------------------
// ESCRITA — a porta
// ---------------------------------------------------------------------------

export interface RegistrarEquipamentoInput {
  companyId: string
  nome: string
  valor: number
  quantidade: number
  unidade: string
  /** a data do FATO (emissão da nota), nunca o relógio do conserto */
  data: Date
  supplierCnpj?: string | null
  supplierNome: string
  chave?: string | null
  nfeId?: string | null
  /** a linha da nota — é ela que dá a idempotência (unique com companyId) */
  nfeItemId?: string | null
  conferenceId?: string | null
  /** o código do fornecedor, quando a nota traz: o casamento preferencial do aprendizado */
  cProd?: string | null
  /** o nome CRU como veio na nota — a chave do aprendizado é o normalizado dele */
  xProd?: string | null
  userId?: string | null
}

/**
 * Registra UM equipamento e **aprende o destino** na mesma transação.
 *
 * ⛔ As duas coisas juntas de propósito: em 01/09 três fichas nasceram órfãs porque o gesto
 * era *"cria → volta na tela → aponta à mão"* e o passo 2 ficou de fora **3 vezes**. Aqui o
 * aprendizado é o que faz o item 2 do brief (*"uma vez só"*) existir — separá-lo seria
 * garantir que um dia ele não roda.
 */
export async function registrarEquipamento(tx: Db, input: RegistrarEquipamentoInput) {
  const nome = (input.nome ?? '').trim()
  if (!nome) throw new EquipamentoError('Equipamento sem nome — a lista do dono precisa de algo que ele reconheça.')
  if (!(input.valor >= 0)) throw new EquipamentoError('Equipamento com valor inválido.')
  if (!(input.quantidade > 0)) throw new EquipamentoError('Equipamento com quantidade inválida.')

  const cnpj = soDigitos(input.supplierCnpj) || null
  const dados = {
    companyId: input.companyId,
    nome,
    valor: round2(input.valor),
    quantidade: input.quantidade,
    unidade: (input.unidade || 'UN').trim().toUpperCase(),
    data: input.data,
    supplierCnpj: cnpj,
    supplierNome: (input.supplierNome ?? '').trim() || '(sem nome)',
    chave: input.chave ?? null,
    nfeId: input.nfeId ?? null,
    conferenceId: input.conferenceId ?? null,
    criadoPorId: input.userId ?? null,
  }

  /**
   * ⚠️ UPSERT pela linha da nota quando ela existe — **idempotência de verdade**: confirmar a
   * conferência duas vezes não dobra o investido. Sem `nfeItemId` (equipamento sem nota, o
   * caminho que a coluna nullable deixa aberto) é `create`, porque não há o que casar.
   */
  const equipamento = input.nfeItemId
    ? await tx.stockEquipamento.upsert({
        where: { companyId_nfeItemId: { companyId: input.companyId, nfeItemId: input.nfeItemId } },
        create: { ...dados, nfeItemId: input.nfeItemId },
        update: dados,
      })
    : await tx.stockEquipamento.create({ data: dados })

  // ⭐ o aprendizado, na MESMA transação
  if (cnpj) {
    await aprenderDestinoEquipamento(tx, {
      companyId: input.companyId,
      supplierCnpj: cnpj,
      cProd: input.cProd ?? null,
      xProd: input.xProd ?? nome,
      userId: input.userId ?? null,
    })
  }

  return equipamento
}

/**
 * ⭐⭐ "BOLEADORA → equipamento, uma vez só" — e com a **EXCLUSÃO MÚTUA** que torna o conflito
 * impossível em vez de resolvido depois.
 *
 * ⛔ Gravar aqui **APAGA** o mapa de item daquela chave. Sem isso, um produto que já foi
 * mapeado como item de estoque uma vez ficaria com duas respostas pra *"pra onde esta linha
 * vai?"*, e a próxima nota seria decidida por qual dos dois `findFirst` rodasse primeiro —
 * que é adivinhação com cara de regra.
 */
export async function aprenderDestinoEquipamento(
  tx: Db,
  input: { companyId: string; supplierCnpj: string; cProd?: string | null; xProd: string; userId?: string | null },
) {
  const cnpj = soDigitos(input.supplierCnpj)
  if (!cnpj) return
  const nomeNorm = normalizarBusca(input.xProd ?? '')
  if (!nomeNorm) return
  const cProd = (input.cProd ?? '').trim() || null

  await tx.stockSupplierEquipamento.upsert({
    where: {
      companyId_supplierCnpj_xProdNormalizado: {
        companyId: input.companyId, supplierCnpj: cnpj, xProdNormalizado: nomeNorm,
      },
    },
    create: {
      companyId: input.companyId, supplierCnpj: cnpj, cProd,
      xProd: input.xProd, xProdNormalizado: nomeNorm, criadoPorId: input.userId ?? null,
    },
    update: { cProd, xProd: input.xProd },
  })

  // ⛔⛔ A OUTRA METADE DA EXCLUSÃO MÚTUA: o mapa de ITEM daquela chave morre.
  await tx.stockSupplierProdutoNome.deleteMany({
    where: { companyId: input.companyId, supplierCnpj: cnpj, xProdNormalizado: nomeNorm },
  })
  if (cProd) {
    await tx.stockSupplierProduct.deleteMany({
      where: { companyId: input.companyId, supplierCnpj: cnpj, cProd },
    })
  }
}

/**
 * ⭐ O caminho inverso, e ele é **obrigatório** pra a exclusão mútua valer nos dois sentidos:
 * o dono classificou algo como equipamento por engano e depois aponta pra um item de estoque.
 *
 * ⚠️ Chamado pelo fluxo NORMAL da conferência — ou seja, **toda** linha de estoque limpa o
 * aprendizado de equipamento daquela chave, mesmo que não houvesse nenhum. Custa um
 * `deleteMany` que não acha nada e paga o dia em que o dono corrige a classificação.
 */
export async function esquecerDestinoEquipamento(
  tx: Db,
  input: { companyId: string; supplierCnpj: string; cProd?: string | null; xProd?: string | null },
) {
  const cnpj = soDigitos(input.supplierCnpj)
  if (!cnpj) return
  const nomeNorm = normalizarBusca(input.xProd ?? '')
  const cProd = (input.cProd ?? '').trim() || null
  if (!nomeNorm && !cProd) return

  await tx.stockSupplierEquipamento.deleteMany({
    where: {
      companyId: input.companyId,
      supplierCnpj: cnpj,
      ...(nomeNorm && cProd
        ? { OR: [{ xProdNormalizado: nomeNorm }, { cProd }] }
        : nomeNorm
          ? { xProdNormalizado: nomeNorm }
          : { cProd }),
    },
  })
}

// ---------------------------------------------------------------------------
// LEITURA — o destino aprendido (pra a tela pré-preencher)
// ---------------------------------------------------------------------------

/**
 * O que este fornecedor já ensinou ser equipamento.
 *
 * Devolve dois conjuntos porque o casamento tem duas chaves: o **código** (preciso, quando a
 * nota traz) e o **nome normalizado** (sempre existe, inclusive no DANFE digitado).
 */
export async function destinosEquipamentoAprendidos(
  db: Db,
  companyId: string,
  supplierCnpj: string | null | undefined,
): Promise<{ porCodigo: Set<string>; porNome: Set<string> }> {
  const cnpj = soDigitos(supplierCnpj)
  if (!cnpj) return { porCodigo: new Set(), porNome: new Set() }
  const linhas = await db.stockSupplierEquipamento.findMany({
    where: { companyId, supplierCnpj: cnpj },
    select: { cProd: true, xProdNormalizado: true },
  })
  return {
    porCodigo: new Set(linhas.map((l) => l.cProd).filter((c): c is string => !!c)),
    porNome: new Set(linhas.map((l) => l.xProdNormalizado)),
  }
}

/**
 * ⭐⭐ "ESTA NOTA É INTEIRA DE EQUIPAMENTO?" — a pergunta do LADO FINANCEIRO.
 *
 * Devolve o DESTINO de cada linha da nota, lido do **FATO GRAVADO**: existe linha em
 * `stock_equipamento` apontando pra aquele `nfeItemId`?
 *
 * ⛔⛔ NUNCA inferido de *"a linha não gerou movimento"*. Inferir da ausência é a doença do
 * `?? 'CAIXA'` que sumiu com o CASPER (20/09) e do `'categoryId' in t` que era verdade com
 * valor nulo (26/08) — e aqui o preço do erro é a categoria financeira da nota.
 *
 * ⚠️ Quem RESPONDE a pergunta é a função PURA `notaInteiraEhEquipamento` (dono único, em
 * `destino-da-linha.ts`): este leitor só busca os fatos. Decidir aqui seria a 2ª régua.
 */
export async function destinosDasLinhasPorNota(
  db: Db,
  companyId: string,
  nfeIds: readonly string[],
): Promise<Map<string, { destino: DestinoDaLinha | null }[]>> {
  const out = new Map<string, { destino: DestinoDaLinha | null }[]>()
  const ids = [...new Set(nfeIds.filter(Boolean))]
  if (ids.length === 0) return out
  // ⚠️ DUAS consultas pra N notas, nunca uma por nota (a lição dos 4.909 ms de 28/09).
  const [linhas, equipamentos] = await Promise.all([
    db.stockNfeItem.findMany({ where: { companyId, nfeId: { in: ids } }, select: { id: true, nfeId: true } }),
    db.stockEquipamento.findMany({ where: { companyId, nfeId: { in: ids } }, select: { nfeItemId: true } }),
  ])
  const deEquipamento = new Set(equipamentos.map((e) => e.nfeItemId).filter((x): x is string => !!x))
  for (const id of ids) out.set(id, [])
  for (const l of linhas) {
    out.get(l.nfeId)?.push({ destino: deEquipamento.has(l.id) ? DESTINO_EQUIPAMENTO : null })
  }
  return out
}

/** casca de UMA nota sobre a leitura em lote — uma consulta, um significado */
export async function destinosDasLinhasDaNota(
  db: Db,
  companyId: string,
  nfeId: string,
): Promise<{ destino: DestinoDaLinha | null }[]> {
  const m = await destinosDasLinhasPorNota(db, companyId, [nfeId])
  return m.get(nfeId) ?? []
}

/**
 * ⭐⭐ O conjunto de notas que são **INTEIRAS de equipamento** — a pergunta que a ponte faz
 * pra decidir a categoria financeira.
 *
 * ⛔ Quem RESPONDE é a função PURA `notaInteiraEhEquipamento`; aqui só se buscam os fatos.
 */
export async function notasInteirasDeEquipamento(
  db: Db,
  companyId: string,
  nfeIds: readonly string[],
): Promise<Set<string>> {
  const porNota = await destinosDasLinhasPorNota(db, companyId, nfeIds)
  const out = new Set<string>()
  for (const [nfeId, linhas] of porNota) {
    if (notaInteiraEhEquipamento(linhas)) out.add(nfeId)
  }
  return out
}

// ---------------------------------------------------------------------------
// ⭐⭐⭐ A RÉGUA ÚNICA — E2 e E16 leem DAQUI
// ---------------------------------------------------------------------------

export interface LinhaDeEquipamento {
  nfeItemId: string | null
  conferenceId: string | null
  chave: string | null
  valor: number
}

/**
 * ⭐⭐ **A RÉGUA ÚNICA.** Uma consulta, dois leitores:
 *
 *   **E2**  agrupa por `conferenceId` → quantas linhas daquela conferência não geram movimento
 *   **E16** agrupa por `chave`        → quanto do `vProd` da nota não entrou no estoque
 *
 * ⛔ Os dois recebem a MESMA lista. Um `where` copiado em cada invariante divergiria no
 * primeiro caso de borda, e aí um ficaria verde e o outro vermelho sobre o mesmo fato.
 *
 * ⚠️ Uma consulta pra o banco INTEIRO (os invariantes varrem todas as empresas, como o resto
 * do juiz faz) — nunca uma por nota, que é o `for (…) await` que custou 4.909 ms em 28/09.
 */
export async function linhasDeEquipamento(
  db: Db,
  companyId?: string,
): Promise<LinhaDeEquipamento[]> {
  return db.stockEquipamento.findMany({
    where: companyId ? { companyId } : {},
    select: { nfeItemId: true, conferenceId: true, chave: true, valor: true },
  })
}

/** E2: quantas linhas de cada conferência são equipamento (e por isso não têm movimento). */
export function equipamentosPorConferencia(linhas: readonly LinhaDeEquipamento[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of linhas) {
    if (!l.conferenceId) continue
    out.set(l.conferenceId, (out.get(l.conferenceId) ?? 0) + 1)
  }
  return out
}

/** E16: quanto do valor declarado de cada nota foi pra imobilizado em vez de estoque. */
export function valorDeEquipamentoPorChave(linhas: readonly LinhaDeEquipamento[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of linhas) {
    if (!l.chave) continue
    out.set(l.chave, round2((out.get(l.chave) ?? 0) + l.valor))
  }
  return out
}

// ---------------------------------------------------------------------------
// LEITURA — a tela
// ---------------------------------------------------------------------------

export interface EquipamentoNaTela {
  id: string
  nome: string
  valor: number
  quantidade: number
  unidade: string
  /** ISO (só a data) — a tela formata; o servidor não decide fuso de exibição */
  data: string
  fornecedor: string
  /** nº da nota extraído da chave (posições 25-34), pro dono reconhecer o documento */
  nNF: string | null
  conferenceId: string | null
}

export interface ListaDeEquipamentos {
  linhas: EquipamentoNaTela[]
  /** ⭐ o número que o brief pede: *"uma tela simples de lista com o total investido"* */
  totalInvestido: number
  /** quantos equipamentos — a tela não conta a lista por fora (a cicatriz do badge × tela) */
  quantos: number
}

const nNFdaChave = (chave: string | null) =>
  chave && chave.length === 44 ? String(Number(chave.slice(25, 34))) : null

export async function listarEquipamentos(
  companyId: string,
  db: Db = defaultPrisma,
): Promise<ListaDeEquipamentos> {
  const linhas = await db.stockEquipamento.findMany({
    where: { companyId },
    orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
  })
  return {
    linhas: linhas.map((e) => ({
      id: e.id,
      nome: e.nome,
      valor: round2(e.valor),
      quantidade: e.quantidade,
      unidade: e.unidade,
      data: e.data.toISOString().slice(0, 10),
      fornecedor: e.supplierNome,
      nNF: nNFdaChave(e.chave),
      conferenceId: e.conferenceId,
    })),
    totalInvestido: round2(linhas.reduce((a, e) => a + e.valor, 0)),
    quantos: linhas.length,
  }
}
