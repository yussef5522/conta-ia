// ESTOQUE FASE 3 PARTE 2 (23/08) — CONTAGEM (template Vuca: lista única, divergência na
// hora, ação por linha). Decisões do dono:
//   (a) 1 sessão ABERTA por vez — garantido pelo ÍNDICE ÚNICO PARCIAL no banco (CAMADA 1),
//       não por checagem da app; a app só traduz a violação em mensagem acionável.
//   (b) ajuste na hora, POR LINHA — confirmar a linha grava o AJUSTE_CONTAGEM no ledger
//       na mesma transação, então o saldo bate enquanto o dono anda pela loja.
//   (c) a CONTAGEM INICIAL é a mesma tela no 1º uso (sessão tipo=INICIAL).
//
// O FREIO: divergência grande exige 2ª confirmação. Não é diálogo de UI — é o SERVIDOR
// que RECUSA gravar sem o aceite explícito (REGRA 5: disciplina vira impossibilidade).
// Um clique distraído não move o ledger.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { TIPO_SABOR } from '@/lib/stock/tipos-ficha'
import { criarMovimento } from './movement'
import { recomputeSaldoCache, saldosDaEmpresa } from './saldo'
import { partirNome } from './contagem/nome-produto'
import { avisoUnidadeSuspeita } from './contagem/unidade-suspeita'
import { ordenarFila } from './contagem/ordem-fila'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000
/** Abaixo disso a diferença é ruído de balança, não divergência. */
const EPS = 0.0001

export class ContagemError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
    this.name = 'ContagemError'
  }
}

// ---------------------------------------------------------------------------
// O FREIO (função PURA — o coração testável)
// ---------------------------------------------------------------------------

/** % de desvio sobre o saldo do sistema que já pede 2ª confirmação. */
export const FREIO_PCT = 0.30
/** Valor absoluto de divergência (R$) que pede 2ª confirmação sozinho. */
export const FREIO_VALOR = 200
/** A regra de % só morde acima deste valor — senão 0,5 KG de sal (R$ 2) viraria alarme.
 *  Alarme que toca à toa treina o dono a clicar sem ler; o freio perde a função. */
export const FREIO_VALOR_MIN = 20

export interface FreioResult {
  grande: boolean
  motivo: string | null
  pct: number | null // |divergência| / saldoSistema (null quando saldo é 0)
  valorDivergencia: number
}

/**
 * Decide se a divergência é GRANDE (pede 2ª confirmação antes de tocar o ledger).
 * Pura: mesma entrada, mesma saída — testável sem banco.
 *
 * Grande quando:
 *   · desvio > 30% do saldo do sistema E vale mais de R$ 20 (erro de contagem provável), OU
 *   · a divergência vale mais de R$ 200 (mesmo que percentualmente pequena).
 * Saldo do sistema ZERO não dispara por percentual (item que nunca teve nota entrando na
 * contagem inicial é normal) — só pela regra de dinheiro.
 */
export function avaliarFreio(saldoSistema: number, qtdContada: number, custoUnitario: number): FreioResult {
  const divergencia = round3(qtdContada - saldoSistema)
  const valorDivergencia = round2(divergencia * (custoUnitario || 0))
  const absValor = Math.abs(valorDivergencia)

  if (Math.abs(divergencia) <= EPS) return { grande: false, motivo: null, pct: null, valorDivergencia: 0 }

  if (absValor > FREIO_VALOR) {
    return { grande: true, motivo: `a diferença vale R$ ${absValor.toFixed(2)} — acima de R$ ${FREIO_VALOR} pede conferência`, pct: saldoSistema > 0 ? Math.abs(divergencia) / saldoSistema : null, valorDivergencia }
  }

  if (saldoSistema > 0) {
    const pct = Math.abs(divergencia) / saldoSistema
    if (pct > FREIO_PCT && absValor >= FREIO_VALOR_MIN) {
      return { grande: true, motivo: `a contagem está ${Math.round(pct * 100)}% fora do sistema (esperado ${round3(saldoSistema)}, contado ${round3(qtdContada)})`, pct, valorDivergencia }
    }
    return { grande: false, motivo: null, pct, valorDivergencia }
  }

  return { grande: false, motivo: null, pct: null, valorDivergencia }
}

/** KG/LT aceitam decimal (balança); UN é inteiro — meia unidade não existe. */
export function validarQuantidade(unidadeControle: string, qtd: number): void {
  if (!Number.isFinite(qtd) || qtd < 0) throw new ContagemError('Quantidade contada tem que ser zero ou mais.')
  if (unidadeControle.toUpperCase() === 'UN' && !Number.isInteger(round3(qtd))) {
    throw new ContagemError('Item controlado em UN só aceita quantidade inteira (meia unidade não existe).')
  }
}

// ---------------------------------------------------------------------------
// SESSÃO
// ---------------------------------------------------------------------------

export async function iniciarContagem(
  companyId: string,
  opts: { tipo?: 'INICIAL' | 'ROTINA'; userId?: string; userName?: string; observacao?: string },
  db: PrismaClient = defaultPrisma,
) {
  // "1 sessão ABERTA por vez" tem DUAS camadas:
  //   · esta checagem — dá a mensagem boa e vale em dev (o `db push` do SQLite não cria
  //     índice parcial, mesma situação do trigger de imutabilidade: Postgres-only);
  //   · o ÍNDICE ÚNICO PARCIAL do banco (prod) — o backstop que segura até corrida entre
  //     dois celulares clicando junto, onde a checagem acima passaria nos dois.
  const aberta = await db.stockContagem.findFirst({ where: { companyId, status: 'ABERTA' }, select: { id: true } })
  if (aberta) throw new ContagemError('Já existe uma contagem aberta — continue a que está em andamento ou finalize antes de começar outra.', 'JA_ABERTA')

  // A 1ª contagem da empresa é a INICIAL (ponto-zero) — a menos que o caller diga.
  const jaHouve = await db.stockContagem.count({ where: { companyId, status: 'FINALIZADA' } })
  const tipo = opts.tipo ?? (jaHouve === 0 ? 'INICIAL' : 'ROTINA')
  try {
    return await db.stockContagem.create({
      data: { companyId, tipo, status: 'ABERTA', criadoPorId: opts.userId ?? null, criadoPorNome: opts.userName ?? null, observacao: opts.observacao ?? null },
    })
  } catch (e: any) {
    // P2002 = o índice único PARCIAL do banco recusou (já há uma ABERTA). CAMADA 1.
    if (e?.code === 'P2002') throw new ContagemError('Já existe uma contagem aberta — continue a que está em andamento ou finalize antes de começar outra.', 'JA_ABERTA')
    throw e
  }
}

export async function contagemAberta(companyId: string, db: Db = defaultPrisma) {
  return db.stockContagem.findFirst({ where: { companyId, status: 'ABERTA' } })
}

export async function finalizarContagem(companyId: string, contagemId: string, db: PrismaClient = defaultPrisma) {
  const c = await db.stockContagem.findFirst({ where: { id: contagemId, companyId } })
  if (!c) throw new ContagemError('Contagem não encontrada.')
  if (c.status !== 'ABERTA') throw new ContagemError('Essa contagem já foi encerrada.')
  const linhas = await db.stockContagemItem.count({ where: { contagemId } })
  if (linhas === 0) throw new ContagemError('Conte ao menos um item antes de finalizar.')
  return db.stockContagem.update({ where: { id: contagemId }, data: { status: 'FINALIZADA', finalizadaEm: new Date() } })
}

/** Cancela a sessão aberta. Os ajustes JÁ gravados no ledger continuam (movimento é
 *  imutável) — cancelar encerra a sessão, não desfaz o que já foi contado. */
export async function cancelarContagem(companyId: string, contagemId: string, db: PrismaClient = defaultPrisma) {
  const c = await db.stockContagem.findFirst({ where: { id: contagemId, companyId } })
  if (!c) throw new ContagemError('Contagem não encontrada.')
  if (c.status !== 'ABERTA') throw new ContagemError('Essa contagem já foi encerrada.')
  return db.stockContagem.update({ where: { id: contagemId }, data: { status: 'CANCELADA', finalizadaEm: new Date() } })
}

// ---------------------------------------------------------------------------
// O QUADRO (a tela)
// ---------------------------------------------------------------------------

export interface LinhaQuadro {
  itemId: string
  nome: string
  categoria: string
  categoriaLabel: string
  unidadeControle: string
  saldoSistema: number
  custoUnitario: number
  /** null = NUNCA foi contado ("sem contagem" cinza — nunca zero). */
  ultimaContagemEm: string | null
  ultimaContagemPor: string | null
  diasSemContagem: number | null
  /** ⭐ o nome partido pro modo contar: "o que é" grande, "qual é" pequeno */
  titulo: string
  especificacao: string
  /** ⚠️ item contável com saldo fracionado — a divergência pode ser do CADASTRO */
  avisoUnidade: string | null
  /** ⭐ estado NESTA sessão: CONTADO tem número; NAO_SEI/PULADO não (e não são "branco") */
  estado: 'CONTADO' | 'NAO_SEI' | 'PULADO' | null
  /** ⭐ ela viu o número do sistema antes de digitar? (contagem cega com rastro) */
  viuSistema: boolean
  observacao: string | null
  /** preenchido quando o item JÁ foi contado NESTA sessão */
  contado: { qtdContada: number; divergencia: number; valorDivergencia: number; contadoPorNome: string | null; contadoEm: string } | null
}

export const CATEGORIA_LABEL: Record<string, string> = {
  MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem',
  LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno', INTERMEDIARIO: 'Intermediário', PRODUTO_FINAL: 'Produto final', SABOR: 'Sabor',
}

export interface Quadro {
  contagem: { id: string; tipo: string; status: string; iniciadaEm: string; criadoPorNome: string | null } | null
  linhas: LinhaQuadro[]
  totalItens: number
  totalContados: number
  /** ⭐ "não sei" NÃO conta como contado nem como pendente mudo — é a apurar */
  totalAApurar: number
  divergenciaValor: number
  /** ⚠️ sessão aberta há mais de 24h — AVISA, nunca fecha sozinha */
  avisoSessao: string | null
}

export async function getQuadro(companyId: string, now: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<Quadro> {
  const [sessao, itens, saldos] = await Promise.all([
    contagemAberta(companyId, db),
    db.stockItem.findMany({
      // ⛔ invólucro de SABOR fica FORA: ninguém pesa "CALABRESA" na câmara — o que existe
      // lá é a porção. Ver `seContaFisicamente` em lib/stock/tipos-ficha.ts.
      where: { companyId, ativo: true, categoria: { not: TIPO_SABOR } },
      select: { id: true, nome: true, categoria: true, unidadeControle: true }, orderBy: { nome: 'asc' },
    }),
    saldosDaEmpresa(db, companyId),
  ])
  const saldoPorItem = new Map(saldos.map((s) => [s.itemId, s]))

  // última contagem POR ITEM (qualquer sessão) — o "quem contou / quando" da tela.
  const ultimas = await db.stockContagemItem.findMany({
    where: { companyId }, orderBy: { contadoEm: 'desc' },
    select: { itemId: true, contadoEm: true, contadoPorNome: true },
  })
  const ultimaPorItem = new Map<string, { contadoEm: Date; contadoPorNome: string | null }>()
  for (const u of ultimas) if (!ultimaPorItem.has(u.itemId)) ultimaPorItem.set(u.itemId, u)

  // o que já foi contado NESTA sessão
  const desta = sessao ? await db.stockContagemItem.findMany({ where: { contagemId: sessao.id } }) : []
  const destaPorItem = new Map(desta.map((d) => [d.itemId, d]))

  // ⭐ o ESTADO vem das VERSÕES (é lá que "não sei" existe — a cabeça só guarda número).
  // A versão mais nova de cada item manda.
  const versoes = sessao
    ? await db.stockContagemVersao.findMany({ where: { contagemId: sessao.id }, orderBy: { versao: 'desc' } })
    : []
  const estadoPorItem = new Map<string, { estado: string; viuSistema: boolean; observacao: string | null }>()
  for (const v of versoes) {
    if (!estadoPorItem.has(v.itemId)) estadoPorItem.set(v.itemId, { estado: v.estado, viuSistema: v.viuSistema, observacao: v.observacao })
  }

  // ⭐ o caminho físico do estoque (vazio = ninguém arrastou nada ainda)
  const ordens = await db.stockContagemOrdem.findMany({ where: { companyId }, select: { itemId: true, ordem: true } })
  const caminho = new Map(ordens.map((o) => [o.itemId, o.ordem]))

  const linhas: LinhaQuadro[] = itens.map((i) => {
    const s = saldoPorItem.get(i.id)
    const u = ultimaPorItem.get(i.id)
    const d = destaPorItem.get(i.id)
    return {
      itemId: i.id, nome: i.nome, categoria: i.categoria,
      categoriaLabel: CATEGORIA_LABEL[i.categoria] ?? i.categoria,
      unidadeControle: i.unidadeControle,
      saldoSistema: s?.saldo ?? 0,
      custoUnitario: s?.custoMedio ?? 0,
      ultimaContagemEm: u ? u.contadoEm.toISOString() : null,
      ultimaContagemPor: u?.contadoPorNome ?? null,
      diasSemContagem: u ? Math.floor((now.getTime() - u.contadoEm.getTime()) / 86_400_000) : null,
      titulo: partirNome(i.nome).titulo,
      especificacao: partirNome(i.nome).especificacao,
      avisoUnidade: avisoUnidadeSuspeita(i.unidadeControle, s?.saldo ?? 0),
      estado: (estadoPorItem.get(i.id)?.estado as LinhaQuadro['estado']) ?? (destaPorItem.get(i.id) ? 'CONTADO' : null),
      viuSistema: estadoPorItem.get(i.id)?.viuSistema ?? false,
      observacao: estadoPorItem.get(i.id)?.observacao ?? null,
      contado: d ? { qtdContada: d.qtdContada, divergencia: d.divergencia, valorDivergencia: d.valorDivergencia, contadoPorNome: d.contadoPorNome, contadoEm: d.contadoEm.toISOString() } : null,
    }
  })

  // ⭐ a fila sai na ordem do CAMINHO quando ele existe; senão, categoria + nome (hoje)
  const ordenadas = ordenarFila(
    linhas.map((l) => ({ itemId: l.itemId, nome: l.nome, categoria: l.categoria })),
    caminho,
  )
  const porId = new Map(linhas.map((l) => [l.itemId, l]))
  const linhasNaOrdem = ordenadas.map((o) => porId.get(o.itemId)!).filter(Boolean)

  return {
    contagem: sessao ? { id: sessao.id, tipo: sessao.tipo, status: sessao.status, iniciadaEm: sessao.iniciadaEm.toISOString(), criadoPorNome: sessao.criadoPorNome } : null,
    linhas: linhasNaOrdem,
    totalItens: linhasNaOrdem.length,
    totalContados: desta.length,
    totalAApurar: linhasNaOrdem.filter((l) => l.estado === 'NAO_SEI').length,
    divergenciaValor: round2(desta.reduce((s, d) => s + d.valorDivergencia, 0)),
    avisoSessao: sessao ? avisoSessaoVelha(sessao.iniciadaEm, now) : null,
  }
}

// ---------------------------------------------------------------------------
// CONTAR UMA LINHA (o ajuste na hora, com o freio)
// ---------------------------------------------------------------------------

export interface ContarLinhaInput {
  companyId: string
  contagemId: string
  itemId: string
  qtdContada: number
  /** aceite explícito da 2ª confirmação — sem ele o servidor RECUSA divergência grande */
  confirmarFreio?: boolean
  /** ⭐ CONTAGEM CEGA: ela apertou "ver o que o sistema diz" antes de digitar? */
  viuSistema?: boolean
  /** ⭐ observação de quem VIU ("estava molhado", "achei em dois lugares") */
  observacao?: string | null
  userId?: string
  userName?: string
}

export interface ContarLinhaResult {
  ok: true
  divergencia: number
  valorDivergencia: number
  saldoSistema: number
  saldoDepois: number
  movementId: string | null
  freio: FreioResult
}

export async function contarLinha(input: ContarLinhaInput, db: PrismaClient = defaultPrisma): Promise<ContarLinhaResult> {
  const sessao = await db.stockContagem.findFirst({ where: { id: input.contagemId, companyId: input.companyId } })
  if (!sessao) throw new ContagemError('Contagem não encontrada.')
  if (sessao.status !== 'ABERTA') throw new ContagemError('Essa contagem já foi encerrada — abra uma nova pra contar.')

  const item = await db.stockItem.findFirst({ where: { id: input.itemId, companyId: input.companyId }, select: { id: true, unidadeControle: true, nome: true } })
  if (!item) throw new ContagemError('Item não encontrado.')
  validarQuantidade(item.unidadeControle, input.qtdContada)

  // SNAPSHOT do teórico no instante — é o que o contador está vendo na tela.
  const saldos = await saldosDaEmpresa(db, input.companyId)
  const s = saldos.find((x) => x.itemId === input.itemId)
  const saldoSistema = s?.saldo ?? 0
  const custoUnitario = s?.custoMedio ?? 0

  const freio = avaliarFreio(saldoSistema, input.qtdContada, custoUnitario)
  if (freio.grande && !input.confirmarFreio) {
    // O SERVIDOR recusa. A 2ª confirmação não é enfeite de tela — sem o aceite explícito
    // o ledger não se move (REGRA 5).
    throw new ContagemError(
      `Confirme: ${item.nome} — ${freio.motivo}. Se estiver certo, confirme de novo pra gravar o ajuste.`,
      'FREIO',
    )
  }

  const divergencia = round3(input.qtdContada - saldoSistema)
  const valorDivergencia = round2(divergencia * custoUnitario)
  const temAjuste = Math.abs(divergencia) > EPS

  const r = await db.$transaction(async (tx) => {
    let movementId: string | null = null
    if (temAjuste) {
      // AJUSTE_CONTAGEM entra no ledger AGORA — o saldo bate enquanto o dono anda.
      // receiptId = id da sessão (mesmo padrão de conferência/ordem; o tipo desambigua).
      const mov = await criarMovimento(tx, {
        companyId: input.companyId, itemId: input.itemId, tipo: 'AJUSTE_CONTAGEM',
        quantidade: divergencia, custoUnitario, custoTotal: valorDivergencia,
        receiptId: input.contagemId, origem: 'MANUAL', criadoPorId: input.userId ?? null,
      })
      movementId = mov.id
    }
    // recontar o mesmo item na mesma sessão = UPDATE da linha (o UNIQUE impede 2ª linha).
    // O movimento anterior NÃO some (é imutável); o novo ajuste parte do saldo já corrigido,
    // então o ledger continua somando pro valor contado.
    await tx.stockContagemItem.upsert({
      where: { contagemId_itemId: { contagemId: input.contagemId, itemId: input.itemId } },
      create: {
        companyId: input.companyId, contagemId: input.contagemId, itemId: input.itemId,
        saldoSistema, qtdContada: input.qtdContada, divergencia, custoUnitario, valorDivergencia,
        movementId, freioConfirmado: !!(freio.grande && input.confirmarFreio),
        contadoPorId: input.userId ?? null, contadoPorNome: input.userName ?? null,
      },
      update: {
        saldoSistema, qtdContada: input.qtdContada, divergencia, custoUnitario, valorDivergencia,
        movementId, freioConfirmado: !!(freio.grande && input.confirmarFreio),
        contadoPorId: input.userId ?? null, contadoPorNome: input.userName ?? null, contadoEm: new Date(),
      },
    })

    // ⭐⭐ O RASTRO, na MESMA transação (31/08): recontar EMPILHA, não sobrescreve.
    // A cabeça (`stock_contagem_item`) fica com o valor atual — é o que o E8 e o ledger
    // leem, e por isso não se toca nela. Aqui fica o que aconteceu no caminho.
    await gravarVersaoNaTx(tx, {
      companyId: input.companyId, contagemId: input.contagemId, itemId: input.itemId,
      estado: 'CONTADO', qtdContada: input.qtdContada, saldoSistema,
      viuSistema: !!input.viuSistema, observacao: input.observacao ?? null,
      userId: input.userId, userName: input.userName,
    })
    return { movementId }
  })

  await recomputeSaldoCache(db, input.companyId)
  return {
    ok: true, divergencia, valorDivergencia, saldoSistema,
    saldoDepois: round3(input.qtdContada), movementId: r.movementId, freio,
  }
}

// ---------------------------------------------------------------------------
// ⭐⭐ O RASTRO — APPEND-ONLY (31/08/2026)
// ---------------------------------------------------------------------------
//
// ⚠️ "Mudou depois? Guarda as duas versões, não sobrescreve" (regra do dono). Cada
// gravação empilha uma versão nova, com o valor ANTERIOR desnormalizado — a revisão mostra
// "era 1,86" sem reler a versão de trás.
//
// ⚠️⚠️ E O RASTRO DIZ **QUEM CONTOU**, NÃO QUEM É CULPADO. Quem descobre a falta não é quem
// causou; se contar virar risco, ninguém conta direito. Por isso o nome fica DENTRO do
// histórico da linha, e a tela nunca o cola no número da divergência.

type TxLike = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

interface VersaoInput {
  companyId: string
  contagemId: string
  itemId: string
  estado: 'CONTADO' | 'NAO_SEI' | 'PULADO'
  qtdContada?: number | null
  saldoSistema: number
  viuSistema?: boolean
  observacao?: string | null
  userId?: string
  userName?: string
}

async function gravarVersaoNaTx(tx: TxLike, v: VersaoInput) {
  const anterior = await tx.stockContagemVersao.findFirst({
    where: { contagemId: v.contagemId, itemId: v.itemId },
    orderBy: { versao: 'desc' },
    select: { versao: true, qtdContada: true },
  })
  return tx.stockContagemVersao.create({
    data: {
      companyId: v.companyId, contagemId: v.contagemId, itemId: v.itemId,
      versao: (anterior?.versao ?? 0) + 1,
      estado: v.estado,
      // ⛔ CHECK no banco: CONTADO exige número; NAO_SEI/PULADO exigem null.
      qtdContada: v.estado === 'CONTADO' ? (v.qtdContada ?? 0) : null,
      qtdAnterior: anterior?.qtdContada ?? null,
      saldoSistema: v.saldoSistema,
      viuSistema: !!v.viuSistema,
      observacao: v.observacao?.trim() || null,
      contadoPorId: v.userId ?? null, contadoPorNome: v.userName ?? null,
    },
  })
}

export interface MarcarLinhaInput {
  companyId: string
  contagemId: string
  itemId: string
  /** ⭐ "não sei / conferir depois" é ESTADO DE PRIMEIRA CLASSE — branco é ambíguo */
  estado: 'NAO_SEI' | 'PULADO'
  observacao?: string | null
  userId?: string
  userName?: string
}

/**
 * ⭐⭐ "NÃO SEI" e "PULAR" — a apurar > número inventado.
 *
 * ⚠️ NÃO MEXE NO LEDGER, e é o ponto: linha sem número não pode virar ajuste. Antes, deixar
 * em branco era ambíguo — "não contei" e "contei e deu zero" eram a mesma coisa na tela.
 * Agora "não sei" é um fato registrado, com quem e quando, e entra na revisão como
 * **a apurar**, nunca como divergência.
 */
export async function marcarLinha(input: MarcarLinhaInput, db: PrismaClient = defaultPrisma) {
  const sessao = await db.stockContagem.findFirst({ where: { id: input.contagemId, companyId: input.companyId } })
  if (!sessao) throw new ContagemError('Contagem não encontrada.')
  if (sessao.status !== 'ABERTA') throw new ContagemError('Essa contagem já foi encerrada — abra uma nova pra contar.')

  const saldos = await saldosDaEmpresa(db, input.companyId)
  const saldoSistema = saldos.find((x) => x.itemId === input.itemId)?.saldo ?? 0

  await db.$transaction(async (tx) => {
    await gravarVersaoNaTx(tx, {
      companyId: input.companyId, contagemId: input.contagemId, itemId: input.itemId,
      estado: input.estado, saldoSistema, observacao: input.observacao ?? null,
      userId: input.userId, userName: input.userName,
    })
  })
  return { ok: true as const, estado: input.estado }
}

export interface VersaoDaLinha {
  versao: number
  estado: string
  qtdContada: number | null
  qtdAnterior: number | null
  viuSistema: boolean
  observacao: string | null
  contadoPorNome: string | null
  contadoEm: string
}

/** o histórico de uma sessão, por item — alimenta o "expandir e ver as versões" */
export async function historicoDaContagem(
  companyId: string, contagemId: string, db: PrismaClient = defaultPrisma,
): Promise<Map<string, VersaoDaLinha[]>> {
  const vs = await db.stockContagemVersao.findMany({
    where: { companyId, contagemId },
    orderBy: [{ itemId: 'asc' }, { versao: 'desc' }],
  })
  const out = new Map<string, VersaoDaLinha[]>()
  for (const v of vs) {
    const lista = out.get(v.itemId) ?? []
    lista.push({
      versao: v.versao, estado: v.estado, qtdContada: v.qtdContada, qtdAnterior: v.qtdAnterior,
      viuSistema: v.viuSistema, observacao: v.observacao,
      contadoPorNome: v.contadoPorNome, contadoEm: v.contadoEm.toISOString(),
    })
    out.set(v.itemId, lista)
  }
  return out
}

// ---------------------------------------------------------------------------
// ⚠️ SESSÃO VELHA — AVISA, NUNCA FECHA SOZINHA
// ---------------------------------------------------------------------------
//
// ⚠️ Fechar sozinho jogaria fora o trabalho de quem está no meio do estoque com o celular
// na mão — e é justamente quem mais precisa que o sistema não atrapalhe. Só avisa, com o
// atalho pra recontar o que ficou velho. É a mesma régua do mínimo sanitário.

export const HORAS_SESSAO_VELHA = 24

export function avisoSessaoVelha(iniciadaEm: Date, agora: Date): string | null {
  const horas = (agora.getTime() - iniciadaEm.getTime()) / 3_600_000
  if (horas < HORAS_SESSAO_VELHA) return null
  const dias = Math.floor(horas / 24)
  const quanto = dias >= 1 ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : `${Math.floor(horas)} horas`
  return `Esta contagem está aberta há ${quanto} — o que foi contado antes pode não valer mais ` +
    '(entrou e saiu mercadoria no meio). Vale recontar as linhas mais antigas antes de finalizar.'
}

// ---------------------------------------------------------------------------
// HISTÓRICO
// ---------------------------------------------------------------------------

export interface ResumoContagem {
  id: string; tipo: string; status: string
  iniciadaEm: string; finalizadaEm: string | null
  criadoPorNome: string | null
  itensContados: number
  itensComDivergencia: number
  valorDivergencia: number
}

export async function listarContagens(companyId: string, db: PrismaClient = defaultPrisma): Promise<ResumoContagem[]> {
  const sessoes = await db.stockContagem.findMany({ where: { companyId }, orderBy: { iniciadaEm: 'desc' }, take: 50 })
  if (sessoes.length === 0) return []
  const linhas = await db.stockContagemItem.findMany({
    where: { contagemId: { in: sessoes.map((s) => s.id) } },
    select: { contagemId: true, divergencia: true, valorDivergencia: true },
  })
  return sessoes.map((s) => {
    const ls = linhas.filter((l) => l.contagemId === s.id)
    return {
      id: s.id, tipo: s.tipo, status: s.status,
      iniciadaEm: s.iniciadaEm.toISOString(), finalizadaEm: s.finalizadaEm ? s.finalizadaEm.toISOString() : null,
      criadoPorNome: s.criadoPorNome,
      itensContados: ls.length,
      itensComDivergencia: ls.filter((l) => Math.abs(l.divergencia) > EPS).length,
      valorDivergencia: round2(ls.reduce((a, l) => a + l.valorDivergencia, 0)),
    }
  })
}
