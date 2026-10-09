/**
 * ⭐⭐⭐ A CONFERÊNCIA DO GERENTE — QUATRO OLHOS NA CONCLUSÃO (09/10/2026).
 *
 * **Ordem do dono:** *"Conclusão nasce no estado AGUARDANDO_CONFERENCIA (tudo o mais igual:
 * baixa, etiqueta, custo — intocados). CONFIRMAR = 1 toque → ✓✓. CORRIGIR = novo número +
 * motivo → nova VERSÃO com rastro. REGRA DURA: conferente ≠ declarante, SEMPRE — nem gerente
 * confere a própria conclusão."* E a régua de produto: ***TODAS as conclusões passam ·
 * estoque/etiqueta saem NA HORA, a conferência vem atrás — nada trava a cozinha.***
 *
 * ⭐⭐ O ESTADO É DERIVADO, NUNCA GRAVADO. Existe linha em `stock_conclusao_conferida`? →
 * conferida. Não existe? → aguardando. ⛔ Duas razões: o isolamento do módulo proíbe ALTER em
 * `stock_producao_conclusao`, **e** campo de estado gravado envelhece (a
 * `CreditCardInvoice.status` eternamente OPEN). ⭐ E derivar entrega *"nada trava a cozinha"*
 * de graça: o estado *aguardando* existe por AUSÊNCIA de carimbo, sem um passo novo no
 * caminho de quem declara.
 *
 * ⛔⛔⛔ **O CARIMBO ASSINA PELA SESSÃO, E O PIN SAIU DO FLUXO (correção do dono, 09/10).**
 *
 * A 1ª versão exigia PIN do conferente, e o defeito apareceu na estreia: **Yussef, marcyelle e
 * cristian não têm PIN e NÃO devem ter.** Nas palavras dele: *"PIN é identidade dos
 * COLABORADORES no tablet COMPARTILHADO; gerente entra com login próprio, e a SESSÃO é a
 * assinatura."* ⭐ Está certo e é mais forte: num aparelho compartilhado o PIN existe porque
 * **não há login**; onde há login pessoal, pedir PIN é inventar uma segunda senha pior (4
 * dígitos, sem rotação) pra provar uma identidade que o cookie já provou.
 *
 * ⛔ E ele **morreu no fluxo, não virou opcional**: o schema da rota é `.strict()` (mandar
 * `pin` dá 400) e o campo saiu da tela. *PIN opcional voltaria na primeira cópia de tela.*
 *
 * ⚠️⚠️ **O QUE A REGRA DURA MANTÉM E O QUE ELA PERDE — medido, não suposto:**
 *   · **o eixo do USUÁRIO fica DURO** (guard + CHECK): `userId` da sessão × `criadoPorId` da
 *     conclusão. É ele que barra o gerente que concluiu pela tela de Produção e tenta se
 *     auto-carimbar — o caso que o dono nomeou.
 *   · **o eixo do COLABORADOR fica INERTE**, porque o conferente deixou de ter identidade de
 *     colaborador. `porQueNaoPodeConferir` **continua checando os dois** (a assinatura não
 *     mudou) e hoje recebe `null` ali: no dia em que existir vínculo colaborador↔usuário,
 *     basta passar o id e ele volta a morder sem mexer na régua.
 *   ⚠️ O flanco está no relatório com nome: quem for colaborador no tablet **e** usuário de
 *     gerência pode declarar com o PIN e carimbar com o login — `stock_colaborador` não aponta
 *     pra `User` (0 de 19 nomes casam, e nome não é identidade). O vínculo é decisão do dono.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { OrdemError } from './ordens'
import { estornarERelancar, preverRelancamento, type PreviewDoRelancamento } from './estorna-e-relanca'

type Db = PrismaClient | Prisma.TransactionClient

export class ConferenciaError extends Error {
  readonly code: string
  constructor(msg: string, code = 'CONFERENCIA') {
    super(msg)
    this.name = 'ConferenciaError'
    this.code = code
  }
}

/**
 * ⭐ OS MOTIVOS DA CORREÇÃO — lista FECHADA, como todo vocabulário desta casa.
 *
 * ⚠️ Mora no TypeScript, **nunca num CHECK de banco**: a cicatriz de 21/09 é que vocabulário
 * fechado em tabela de configuração virou parede **em um dia**, e migration aplicada não se
 * reescreve. O CHECK cuida da FORMA (número sem motivo é impossível); a lista cuida do
 * vocabulário, e se acrescenta editando uma linha.
 */
export const MOTIVOS_DA_CORRECAO = ['CONTOU_ERRADO', 'DIGITOU_ERRADO', 'OUTRO'] as const
export type MotivoDaCorrecao = (typeof MOTIVOS_DA_CORRECAO)[number]

export const ROTULO_DO_MOTIVO: Record<MotivoDaCorrecao, string> = {
  CONTOU_ERRADO: 'contou errado',
  DIGITOU_ERRADO: 'digitou errado',
  OUTRO: 'outro',
}

/** ⭐ o estado de uma conclusão — três, e cada um tem selo próprio na tela */
export type EstadoDaConferencia = 'AGUARDANDO_CONFERENCIA' | 'CONFERIDA' | 'CORRIGIDA_E_CONFERIDA'

export interface CarimboDaConferencia {
  estado: EstadoDaConferencia
  conferidoPorNome: string | null
  conferidoEm: Date | null
  /** o número que o declarante havia posto — só existe quando houve correção */
  corrigiuDe: number | null
  motivoDaCorrecao: string | null
}

export const AGUARDANDO: CarimboDaConferencia = {
  estado: 'AGUARDANDO_CONFERENCIA',
  conferidoPorNome: null,
  conferidoEm: null,
  corrigiuDe: null,
  motivoDaCorrecao: null,
}

/**
 * ⭐⭐ O ESTADO DE N CONCLUSÕES, EM UMA CONSULTA (REGRA 4 + a lição dos 4.909 ms).
 *
 * ⚠️ A lista de concluídas e a home leem dezenas de linhas por carregamento: uma consulta por
 * conclusão aqui seria o N+1 de 28/09 outra vez, numa tela de todo dia.
 */
export async function carimbosDasConclusoes(
  companyId: string,
  conclusaoIds: string[],
  db: Db = defaultPrisma,
): Promise<Map<string, CarimboDaConferencia>> {
  const out = new Map<string, CarimboDaConferencia>()
  const ids = [...new Set(conclusaoIds)]
  if (!ids.length) return out
  const rows = await db.stockConclusaoCarimbo.findMany({
    where: { companyId, conclusaoId: { in: ids } },
    select: { conclusaoId: true, conferidoPorNome: true, conferidoEm: true, corrigiuDe: true, motivoDaCorrecao: true },
  })
  for (const r of rows) {
    out.set(r.conclusaoId, {
      /** ⭐ o estado SAI DO DADO: corrigiuDe preenchido é o que distingue os dois ✓✓ */
      estado: r.corrigiuDe != null ? 'CORRIGIDA_E_CONFERIDA' : 'CONFERIDA',
      conferidoPorNome: r.conferidoPorNome,
      conferidoEm: r.conferidoEm,
      corrigiuDe: r.corrigiuDe,
      motivoDaCorrecao: r.motivoDaCorrecao,
    })
  }
  /** ⚠️ quem não tem linha é AGUARDANDO — a ausência É o estado, e não um buraco */
  for (const id of ids) if (!out.has(id)) out.set(id, AGUARDANDO)
  return out
}

/**
 * ⛔⛔⛔ A REGRA DURA, PURA E TESTÁVEL: conferente ≠ declarante, nos DOIS eixos.
 *
 * ⚠️ São dois porque são dois espaços de identidade (ver o cabeçalho). Checar UM deixaria um
 * buraco de cada lado:
 *   · só o colaborador → o gerente que concluiu **pela tela de Produção** (sem PIN, só sessão)
 *     conferiria a própria conclusão com o PIN de qualquer cozinheiro;
 *   · só o usuário → as 397 do tablet não têm usuário nenhum, e a regra nunca morderia nelas.
 *
 * ⭐ E a recusa NOMEIA A REGRA (não um "não pode"): quem lê entende o porquê e não tenta de
 * novo achando que é bug.
 */
export function porQueNaoPodeConferir(input: {
  /** o USUÁRIO da sessão — a assinatura */
  conferidoPorId: string
  /**
   * ⚠️ `null` HOJE, de propósito: o carimbo assina pela sessão e o conferente não tem
   * identidade de colaborador. O parâmetro FICA porque é o lado direito da comparação no dia
   * em que existir vínculo colaborador↔usuário — remover a checagem agora obrigaria a
   * reescrever a régua depois, e régua reescrita é régua que diverge.
   */
  conferidoPorColaboradorId: string | null
  declaradoPorId: string | null
  declaradoPorColaboradorId: string | null
  nomeDoConferente: string
}): string | null {
  if (
    input.conferidoPorColaboradorId &&
    input.declaradoPorColaboradorId &&
    input.conferidoPorColaboradorId === input.declaradoPorColaboradorId
  ) {
    return (
      `${input.nomeDoConferente} foi quem declarou esta produção. ` +
      `Conferência é de QUATRO OLHOS: quem confere nunca é quem declarou — nem gerente confere a própria conclusão.`
    )
  }
  if (input.declaradoPorId && input.conferidoPorId === input.declaradoPorId) {
    return (
      `Esta conclusão foi lançada por você. ` +
      `Conferência é de QUATRO OLHOS: quem confere nunca é quem declarou — nem gerente confere a própria conclusão.`
    )
  }
  return null
}

interface Alvo {
  conclusao: { id: string; ordemId: string; qtdGerada: number; colaboradorId: string | null; criadoPorId: string | null }
  /** ⭐ o conferente é o USUÁRIO da sessão — o nome vai pro selo como SNAPSHOT */
  conferente: { userId: string; nome: string }
}

/**
 * Resolve o conferente pela SESSÃO e aplica a regra dura. ⛔ Faz isso ANTES de qualquer
 * escrita: a recusa não pode deixar meio carimbo nem meio relançamento.
 *
 * ⚠️ O `userId` vem do `guardStock` da rota, que já provou o papel `stock.manage`. Aqui ele é
 * resolvido contra o BANCO **e contra a empresa**: sessão sem usuário vivo nesta empresa não
 * carimba nada — é a REGRA 8 (resolver por ID, dentro do escopo) aplicada à assinatura.
 */
async function resolverAlvo(
  input: { companyId: string; conclusaoId: string; userId: string },
  db: PrismaClient,
): Promise<Alvo> {
  const conclusao = await db.stockProducaoConclusao.findFirst({
    where: { id: input.conclusaoId, companyId: input.companyId },
    select: { id: true, ordemId: true, qtdGerada: true, colaboradorId: true, criadoPorId: true },
  })
  if (!conclusao) throw new ConferenciaError('Esta conclusão não existe nesta empresa.', 'NAO_ENCONTRADA')

  const ja = await db.stockConclusaoCarimbo.findUnique({ where: { conclusaoId: input.conclusaoId } })
  if (ja) {
    throw new ConferenciaError(
      `Esta produção já foi conferida por ${ja.conferidoPorNome} em ${ja.conferidoEm.toLocaleString('pt-BR')}.`,
      'JA_CONFERIDA',
    )
  }

  /**
   * ⛔⛔ A ASSINATURA EXIGE **SESSÃO PESSOAL E PAPEL NESTA EMPRESA** — e isso é checado contra
   * o banco, não presumido do cookie. Sem `userId`, ou com um usuário que não é membro desta
   * empresa, o carimbo não acontece: o selo diria "✓✓ conferido" sem ninguém por trás.
   */
  if (!input.userId?.trim()) {
    throw new ConferenciaError(
      'Conferir exige login pessoal: o carimbo é a sua assinatura. Entre com a sua conta de gerência.',
      'SEM_SESSAO',
    )
  }
  const vinculo = await db.userCompanyRole.findFirst({
    where: { userId: input.userId, companyId: input.companyId },
    select: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!vinculo?.user) {
    throw new ConferenciaError(
      'A sua conta não tem papel nesta empresa — só quem gerencia o estoque carimba conferência.',
      'SEM_PAPEL',
    )
  }
  const conferente = {
    userId: vinculo.user.id,
    /** ⚠️ nome vazio cairia no CHECK de forma do banco; o e-mail é o fallback honesto */
    nome: vinculo.user.name?.trim() || vinculo.user.email,
  }

  /**
   * ⚠️ O eixo do COLABORADOR entra como `null` HOJE (o conferente não tem PIN) — e a régua
   * continua recebendo os dois de propósito: no dia do vínculo colaborador↔usuário, basta
   * passar o id aqui e ela volta a morder sem uma linha nova.
   */
  const barrado = porQueNaoPodeConferir({
    conferidoPorId: conferente.userId,
    conferidoPorColaboradorId: null,
    declaradoPorId: conclusao.criadoPorId,
    declaradoPorColaboradorId: conclusao.colaboradorId,
    nomeDoConferente: conferente.nome,
  })
  if (barrado) throw new ConferenciaError(barrado, 'CONFERENTE_IGUAL_DECLARANTE')

  return { conclusao, conferente }
}

/** ⭐ (a) CONFIRMAR — **1 toque**, assinado pela sessão. O número do declarante fica como está. */
export async function confirmarConclusao(
  input: { companyId: string; conclusaoId: string; userId: string },
  db: PrismaClient = defaultPrisma,
): Promise<{ conferidoPorNome: string; conferidoEm: Date }> {
  const { conclusao, conferente } = await resolverAlvo(input, db)
  const row = await db.stockConclusaoCarimbo.create({
    data: {
      companyId: input.companyId,
      conclusaoId: conclusao.id,
      conferidoPorId: conferente.userId,
      conferidoPorNome: conferente.nome,
      declaradoPorId: conclusao.criadoPorId,
      declaradoPorColaboradorId: conclusao.colaboradorId,
    },
  })
  return { conferidoPorNome: row.conferidoPorNome, conferidoEm: row.conferidoEm }
}

/**
 * ⭐ A PRÉVIA DA CORREÇÃO — o que muda no estoque antes de gravar (ordem do dono).
 *
 * ⛔⛔ E ELA RECUSA QUANDO O LEDGER JÁ FOI CONSERTADO POR FORA — achado medindo os 2 casos
 * de 22.864 em prod. Lá a geração podre **já está estornada** (líquido 22,864 desde 19/09) e
 * só a CONCLUSÃO continua dizendo 22864. `preverRelancamento` acha o movimento pela
 * quantidade da conclusão, pega o ANULADO, e `estornarMovimento` é idempotente (devolve o
 * estorno que já existe) — mas o movimento NOVO **somaria em cima do que já está vivo**,
 * ***dobrando o lote***. A recusa nomeia o estado e manda usar a correção só-da-conclusão.
 */
export async function preverCorrecao(
  companyId: string,
  conclusaoId: string,
  qtdCerta: number,
  db: PrismaClient = defaultPrisma,
): Promise<{ modo: 'ESTORNA_E_RELANCA'; preview: PreviewDoRelancamento } | { modo: 'SO_A_CONCLUSAO'; porque: string; antes: number; depois: number }> {
  const c = await db.stockProducaoConclusao.findFirst({ where: { id: conclusaoId, companyId }, select: { ordemId: true, qtdGerada: true } })
  if (!c) throw new ConferenciaError('Esta conclusão não existe nesta empresa.', 'NAO_ENCONTRADA')
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: c.ordemId, companyId }, select: { itemProduzidoId: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')

  const ger = await db.stockMovement.findFirst({
    where: { companyId, itemId: ordem.itemProduzidoId, tipo: 'PRODUCAO_GERACAO', receiptId: c.ordemId, quantidade: c.qtdGerada },
    select: { id: true },
    orderBy: { dataMovimento: 'desc' },
  })
  /** ⚠️ o estorno tem TIPO PRÓPRIO (`ESTORNO`) e aponta pelo `estornoDeId` — procurar por
   *  tipo `PRODUCAO_GERACAO` acharia só as gerações e diria que nada foi anulado */
  const anulado = ger
    ? await db.stockMovement.findFirst({ where: { companyId, estornoDeId: ger.id, tipo: 'ESTORNO' }, select: { id: true } })
    : null

  if (!ger || anulado) {
    return {
      modo: 'SO_A_CONCLUSAO',
      porque: !ger
        ? 'o movimento desta conclusão não está no ledger (já foi estornado ou relançado por fora) — então aqui só a conclusão é corrigida'
        : 'o estoque desta produção JÁ foi corrigido por fora (a geração está estornada) — mexer no ledger agora DOBRARIA o lote, então aqui só a conclusão é corrigida',
      antes: c.qtdGerada,
      depois: qtdCerta,
    }
  }
  return { modo: 'ESTORNA_E_RELANCA', preview: await preverRelancamento(companyId, conclusaoId, qtdCerta, db) }
}

/**
 * ⭐ (b) CORRIGIR — número novo + motivo → **nova VERSÃO com rastro**, assinada pela sessão.
 *
 * ⛔ A conclusão velha **não é editada**: ela fica como o registro do que foi declarado (é o
 * "declarado original fica no histórico" que o dono pediu), sai das médias pelo
 * `stock_conclusao_estornada`, e a NOVA é a que passa a valer — a mesma disciplina do ledger
 * imutável, um nível acima.
 *
 * ⚠️ E o carimbo vai na conclusão **NOVA**: foi ela que o gerente conferiu. Carimbar a velha
 * diria "conferido" sobre o número que ele acabou de rejeitar.
 */
export async function corrigirConclusao(
  input: {
    companyId: string
    conclusaoId: string
    qtdCerta: number
    motivo: MotivoDaCorrecao
    observacao?: string | null
    /** ⭐ a ASSINATURA — nada de PIN aqui (ordem do dono, 09/10) */
    userId: string
  },
  db: PrismaClient = defaultPrisma,
): Promise<{ conclusaoNovaId: string; conferidoPorNome: string; corrigiuDe: number; modo: string }> {
  if (!(input.qtdCerta > 0)) throw new ConferenciaError('O número certo tem que ser maior que zero.', 'QTD_INVALIDA')
  if (!MOTIVOS_DA_CORRECAO.includes(input.motivo)) throw new ConferenciaError('Diga por que o número muda.', 'MOTIVO_INVALIDO')
  /** ⚠️ OUTRO sem texto seria "corrigi porque quis" — o motivo existe pra explicar em 3 meses */
  if (input.motivo === 'OUTRO' && !input.observacao?.trim()) {
    throw new ConferenciaError('Escolheu «outro»: escreva em uma linha o que houve.', 'OBSERVACAO_OBRIGATORIA')
  }

  const { conclusao, conferente } = await resolverAlvo(input, db)
  if (Math.abs(conclusao.qtdGerada - input.qtdCerta) < 1e-9) {
    throw new ConferenciaError('Esse é o mesmo número que já está lá — pra concordar, use o confirmar.', 'SEM_MUDANCA')
  }

  const rotulo = ROTULO_DO_MOTIVO[input.motivo]
  const motivoTexto = input.motivo === 'OUTRO' ? `outro: ${input.observacao!.trim()}` : rotulo

  const plano = await preverCorrecao(input.companyId, input.conclusaoId, input.qtdCerta, db)

  let conclusaoNovaId: string
  if (plano.modo === 'ESTORNA_E_RELANCA') {
    /** ⭐ a PORTA EXISTENTE (19/09) — estorno + movimento novo + conclusão nova, uma transação */
    const r = await estornarERelancar(
      {
        companyId: input.companyId,
        conclusaoId: input.conclusaoId,
        qtdCerta: input.qtdCerta,
        motivo: `conferência do gerente: ${motivoTexto}`,
        userId: input.userId,
      },
      db,
    )
    conclusaoNovaId = r.conclusaoNovaId
  } else {
    /**
     * ⛔ SÓ A CONCLUSÃO — o ledger já está certo (ver `preverCorrecao`). A conclusão nova
     * espelha o movimento que está VIVO; tocar no ledger aqui dobraria o lote.
     */
    const { marcarConclusaoEstornada } = await import('./conclusao-estornada')
    const velha = await db.stockProducaoConclusao.findFirstOrThrow({ where: { id: input.conclusaoId, companyId: input.companyId } })
    conclusaoNovaId = await db.$transaction(async (tx) => {
      const nova = await tx.stockProducaoConclusao.create({
        data: {
          companyId: input.companyId,
          ordemId: velha.ordemId,
          qtdGerada: input.qtdCerta,
          colaboradorId: velha.colaboradorId,
          escalaConsumida: velha.escalaConsumida,
          custoLoteReal: velha.custoLoteReal,
          /** ⚠️ o custo do LOTE não muda (o consumo foi o que foi); o UNITÁRIO é derivado */
          custoUnitarioReal: Math.round((velha.custoLoteReal / input.qtdCerta) * 100) / 100,
          rendimento: Math.round((input.qtdCerta / (velha.escalaConsumida || 1)) * 10000) / 10000,
          validadeAte: velha.validadeAte,
          parcial: velha.parcial,
          criadoPorId: input.userId,
        },
      })
      await marcarConclusaoEstornada(
        {
          companyId: input.companyId,
          conclusaoId: input.conclusaoId,
          motivo: `conferência do gerente: ${motivoTexto} (o estoque já estava correto — só a conclusão foi corrigida)`,
          userId: input.userId,
        },
        tx,
      )
      return nova.id
    })
  }

  /** ⭐ o carimbo vai na NOVA, com o número antigo no rastro — é o selo "era X" da tela */
  await db.stockConclusaoCarimbo.create({
    data: {
      companyId: input.companyId,
      conclusaoId: conclusaoNovaId,
      conferidoPorId: conferente.userId,
      conferidoPorNome: conferente.nome,
      declaradoPorId: conclusao.criadoPorId,
      declaradoPorColaboradorId: conclusao.colaboradorId,
      corrigiuDe: conclusao.qtdGerada,
      motivoDaCorrecao: motivoTexto,
    },
  })

  return { conclusaoNovaId, conferidoPorNome: conferente.nome, corrigiuDe: conclusao.qtdGerada, modo: plano.modo }
}
