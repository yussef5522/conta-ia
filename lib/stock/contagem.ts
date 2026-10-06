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
import { CATEGORIAS_SEM_PRATELEIRA } from '@/lib/stock/tipos-ficha'
import { criarMovimento } from './movement'
import {
  valorarContagem, ehMotivoDoNegativo, fraseDoMotivo, MOTIVOS_DO_NEGATIVO,
  TIPOS_COM_CUSTO_CONHECIDO, TIPO_CONTAGEM, type ValoracaoDaContagem,
} from './contagem-ancora'
import { TIPO_AJUSTE_RESIDUO } from './entrada-cruza-o-zero'
import { recomputeSaldoCache, saldosDaEmpresa } from './saldo'
import { partirNome } from './contagem/nome-produto'
import { avisoUnidadeSuspeita } from './contagem/unidade-suspeita'
import { ordenarFila } from './contagem/ordem-fila'
import { acharTrocaDeEscala } from './escala'

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
  /**
   * ⭐⭐ A PERGUNTA ESPECÍFICA (20/09/2026) — *"você quis dizer 16,6?"*.
   *
   * ⛔ Nasceu de prod: `CREME LEITE 200GR` contada como **16.600** com o sistema em **177**,
   * **freio confirmado**, R$ 39.342,36 de fantasma até hoje. O freio tinha PERGUNTADO — e a
   * pergunta era *"a contagem está 9280% fora"*. ***Pergunta vaga é pergunta que se
   * confirma sem ler.*** Quando existe a assinatura de troca de escala, a tela oferece o
   * número certo em 1 toque; confirmar o absurdo continua possível.
   */
  sugestao: { provavel: number; fator: number } | null
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
export function avaliarFreio(
  saldoSistema: number,
  qtdContada: number,
  custoUnitario: number,
  item?: { unidadeControle?: string },
): FreioResult {
  const divergencia = round3(qtdContada - saldoSistema)
  const valorDivergencia = round2(divergencia * (custoUnitario || 0))
  const absValor = Math.abs(valorDivergencia)

  if (Math.abs(divergencia) <= EPS) return { grande: false, motivo: null, pct: null, valorDivergencia: 0, sugestao: null }

  /**
   * ⭐⭐ A ASSINATURA DE ESCALA VEM PRIMEIRO — porque ela troca a pergunta, não só a
   * decisão. ⚠️ A régua mora em `lib/stock/escala.ts` (pura, testada): aqui não se
   * reimplementa "o que é mil vezes", senão vira a segunda régua de sempre.
   */
  const un = (item?.unidadeControle ?? '').toUpperCase()
  const escala = acharTrocaDeEscala(qtdContada, saldoSistema, {
    unidadeInteira: un === 'UN',
    unidade: item?.unidadeControle,
  })
  if (escala) {
    return {
      grande: true,
      motivo: escala.pergunta,
      pct: saldoSistema > 0 ? Math.abs(divergencia) / saldoSistema : null,
      valorDivergencia,
      sugestao: { provavel: escala.provavel, fator: escala.fator },
    }
  }

  if (absValor > FREIO_VALOR) {
    return { grande: true, motivo: `a diferença vale R$ ${absValor.toFixed(2)} — acima de R$ ${FREIO_VALOR} pede conferência`, pct: saldoSistema > 0 ? Math.abs(divergencia) / saldoSistema : null, valorDivergencia, sugestao: null }
  }

  if (saldoSistema > 0) {
    const pct = Math.abs(divergencia) / saldoSistema
    if (pct > FREIO_PCT && absValor >= FREIO_VALOR_MIN) {
      return { grande: true, motivo: `a contagem está ${Math.round(pct * 100)}% fora do sistema (esperado ${round3(saldoSistema)}, contado ${round3(qtdContada)})`, pct, valorDivergencia, sugestao: null }
    }
    return { grande: false, motivo: null, pct, valorDivergencia, sugestao: null }
  }

  return { grande: false, motivo: null, pct: null, valorDivergencia, sugestao: null }
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
      // ⛔ invólucro de SABOR e de PRODUTO_FINAL ficam FORA: ninguém pesa "CALABRESA" nem
      // "COCA COLA 2L (a linha do menu)" na câmara — o que existe
      // lá é a porção. Ver `seContaFisicamente` em lib/stock/tipos-ficha.ts.
      where: { companyId, ativo: true, categoria: { notIn: [...CATEGORIAS_SEM_PRATELEIRA] } },
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
  /**
   * ⛔⛔ OBRIGATÓRIO quando o item estava NEGATIVO (05/10) — 1 toque numa lista fechada.
   *
   * ⚠️ E isto **não é a recusa de volta**: a contagem ENTRA depois da resposta. O motivo é o
   * que faz o negativo não morrer calado — ele vira o rastro e o aviso de investigação.
   */
  motivoDoNegativo?: string | null
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
  /** ⭐ a valoração que a âncora aplicou — a tela DIZ em que custo ela se apoiou */
  valoracao: ValoracaoDaContagem
  /** ⭐ o id do movimento de resíduo, quando houve dinheiro pendurado a escrever fora */
  residuoMovementId: string | null
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

  /**
   * ⭐⭐⭐ A VALORAÇÃO DA ÂNCORA (05/10) — **dono único**, e o FREIO lê a MESMA saída.
   *
   * ⚠️⚠️ Medido em prod: nos 8 itens negativos da Caçula o `custoMedio` vem **null** (o
   * `saldo.ts` se recusa, com razão, a dividir valor negativo por saldo negativo). Com ele em
   * zero, o freio avaliaria a correção por **R$ 0,00** e deixaria de perguntar justamente na
   * correção grande — e o ledger gravaria o ajuste sem dinheiro. **Duas leituras do mesmo
   * número divergem onde dói**; aqui há uma só.
   */
  const ultimo = await db.stockMovement.findFirst({
    where: {
      companyId: input.companyId, itemId: input.itemId,
      tipo: { in: [...TIPOS_COM_CUSTO_CONHECIDO] },
      custoUnitario: { gt: 0 },
    },
    orderBy: [{ dataMovimento: 'desc' }, { criadoEm: 'desc' }],
    select: { custoUnitario: true },
  })
  const valoracao = valorarContagem({
    saldoSistema,
    valorAtual: s?.valor ?? 0,
    contado: input.qtdContada,
    custoMedio: s?.custoMedio ?? null,
    ultimoCustoConhecido: ultimo?.custoUnitario ?? null,
  })
  const custoUnitario = valoracao.custoUnitario

  const freio = avaliarFreio(saldoSistema, input.qtdContada, custoUnitario, item)
  if (freio.grande && !input.confirmarFreio) {
    // O SERVIDOR recusa. A 2ª confirmação não é enfeite de tela — sem o aceite explícito
    // o ledger não se move (REGRA 5).
    //
    // ⭐⭐ E QUANDO HÁ ASSINATURA DE ESCALA, a recusa carrega o NÚMERO CERTO (20/09): o
    // `code` muda pra `FREIO_ESCALA` e a `sugestao` vai no erro, pra a tela oferecer
    // *"usar 16,6"* em 1 toque. ⛔ Confirmar o absurdo continua possível — o que morreu
    // foi a pergunta vaga que se confirma sem ler.
    const err = new ContagemError(
      freio.sugestao
        ? `${item.nome}: ${freio.motivo} Se for isso mesmo, confirme de novo pra gravar.`
        : `Confirme: ${item.nome} — ${freio.motivo}. Se estiver certo, confirme de novo pra gravar o ajuste.`,
      freio.sugestao ? 'FREIO_ESCALA' : 'FREIO',
    ) as ContagemError & { sugestao?: { provavel: number; fator: number } }
    if (freio.sugestao) err.sugestao = freio.sugestao
    throw err
  }

  /**
   * ⛔⛔ ITEM NEGATIVO PEDE MOTIVO — **1 toque, lista fechada, e a contagem ENTRA depois.**
   *
   * ⚠️ Isto NÃO é a recusa de 22/09 de volta: ali o desfecho era *"a contagem espera"* e não
   * havia gesto nenhum que fechasse a diferença. Aqui a frase **promete o desfecho** e o
   * motivo é o que faz o negativo não morrer calado — ele vira o rastro e o aviso de
   * investigação. ⛔ E a trava é do SERVIDOR: esconder o seletor na tela não impede a chamada
   * (a régua do FREIO, 23/08).
   */
  if (valoracao.eraNegativo && !ehMotivoDoNegativo(input.motivoDoNegativo)) {
    const err = new ContagemError(
      fraseDoMotivo(item.nome, saldoSistema, s?.valor ?? 0, item.unidadeControle),
      'MOTIVO_DO_NEGATIVO',
    ) as ContagemError & { motivos?: typeof MOTIVOS_DO_NEGATIVO }
    err.motivos = MOTIVOS_DO_NEGATIVO
    throw err
  }

  const divergencia = valoracao.divergencia
  const valorDivergencia = valoracao.custoTotal
  const temAjuste = Math.abs(divergencia) > EPS

  const r = await db.$transaction(async (tx) => {
    let movementId: string | null = null
    let residuoMovementId: string | null = null
    if (temAjuste) {
      // AJUSTE_CONTAGEM entra no ledger AGORA — o saldo bate enquanto o dono anda.
      // receiptId = id da sessão (mesmo padrão de conferência/ordem; o tipo desambigua).
      const mov = await criarMovimento(tx, {
        companyId: input.companyId, itemId: input.itemId, tipo: TIPO_CONTAGEM,
        quantidade: divergencia, custoUnitario, custoTotal: valorDivergencia,
        receiptId: input.contagemId, origem: 'MANUAL', criadoPorId: input.userId ?? null,
        // ⭐ passou por `valorarContagem`: o estado final da transação é válido
        ancoraValorada: true,
      })
      movementId = mov.id
    }
    /**
     * ⛔⛔⛔ **O RESÍDUO É LINHA PRÓPRIA — "nunca por dentro do custo"** (ordem do dono).
     *
     * Enfiá-lo no `custoUnitario` da linha acima daria o total certo e **um custo por unidade
     * inventado**: no fermento, R$ 24,63/kg num item que custa R$ 34,00. O custo médio
     * alimenta ficha, cardápio e CMV — é a parte da ordem que protege todo o resto.
     *
     * ⚠️ O idioma é o do `encerrar-item` (REGRA 4): quantidade **0,001** (o CHECK do ledger
     * recusa zero, e o `round2` do saldo absorve) e o unitário **DERIVADO do total**, nunca
     * montado na mão — lá isso errou o sinal e o banco recusou por 14 centavos.
     */
    if (valoracao.residuo !== 0) {
      const q = 0.001
      const total = round2(valoracao.residuo)
      const mov = await criarMovimento(tx, {
        companyId: input.companyId, itemId: input.itemId, tipo: TIPO_AJUSTE_RESIDUO,
        quantidade: q, custoUnitario: total / q, custoTotal: total,
        receiptId: input.contagemId, origem: 'MANUAL', criadoPorId: input.userId ?? null,
        ancoraValorada: true,
      })
      residuoMovementId = mov.id
    }
    /**
     * ⭐⭐ O RASTRO DO NEGATIVO, na MESMA transação: o estado de antes congelado + a causa que
     * a pessoa nomeou + em que custo a valoração se apoiou. É daqui que o aviso de
     * investigação do sininho nasce — **um fato, uma fonte**.
     */
    if (valoracao.eraNegativo) {
      const dados = {
        companyId: input.companyId, contagemId: input.contagemId, itemId: input.itemId,
        saldoAntes: saldoSistema, valorAntes: s?.valor ?? 0, contado: input.qtdContada,
        motivo: input.motivoDoNegativo as string,
        baseDoCusto: valoracao.base, custoUsado: valoracao.custoUnitario, residuo: valoracao.residuo,
        registradoPorId: input.userId ?? null, registradoPorNome: input.userName ?? null,
      }
      // ⚠️ recontar o mesmo item na mesma sessão é UPDATE, nunca uma 2ª linha (o unique)
      await tx.stockContagemNegativo.upsert({
        where: { contagemId_itemId: { contagemId: input.contagemId, itemId: input.itemId } },
        create: dados,
        update: { ...dados, criadoEm: new Date() },
      })
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
    return { movementId, residuoMovementId }
  })

  await recomputeSaldoCache(db, input.companyId)
  /**
   * ⛔⛔ O AVISO DE INVESTIGAÇÃO SAI AGORA, não às 3h — **o negativo não morre calado**.
   *
   * ⭐ E é o **MESMO produtor** que o cron chama (`produzirAvisosDeEstoque`), nunca uma
   * segunda redação do alarme: um gravador "na hora" e outro "na madrugada" divergiriam na
   * primeira frase ajustada (o padrão do `garantirCiencia`, 05/09).
   *
   * ⚠️⚠️ **FAIL-SOFT e FORA da transação, de propósito.** A contagem do dono **já gravou**;
   * uma falha da central (texto recusado, tabela lenta) não pode desfazer o ajuste que ele
   * acabou de fazer na câmara. Se falhar, o cron das 3h pega — e é pra isso que ele existe.
   */
  if (valoracao.eraNegativo) {
    try {
      const { produzirAvisosDeEstoque } = await import('@/lib/avisos/produtores/estoque')
      await produzirAvisosDeEstoque(input.companyId, new Date(), db)
    } catch (e) {
      console.error('[contagem] aviso de investigação falhou (o cron das 3h pega):', e)
    }
  }

  return {
    ok: true, divergencia, valorDivergencia, saldoSistema,
    saldoDepois: round3(input.qtdContada), movementId: r.movementId, freio,
    valoracao, residuoMovementId: r.residuoMovementId,
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
