/**
 * ⭐⭐⭐ OS PRODUTORES DE AVISO DA PRODUÇÃO (04/10/2026).
 *
 * **Ordem do dono:** *"os produtores já existem: o juiz das 3h e os guards passam a GRAVAR
 * aviso além do e-mail (e-mail continua como cópia)."*
 *
 * ⛔⛔ **ESTE ARQUIVO É A "PRIMEIRA CARGA" E O CRON AO MESMO TEMPO — de propósito.** O dono
 * pediu que *"os achados vivos de hoje virem avisos, pra a central nascer útil, não vazia"*. A
 * tentação era um script de carga separado; **isso criaria duas verdades** (um script que
 * traduz os achados de hoje + um produtor que traduz os de amanhã), e elas divergiriam na
 * primeira frase ajustada. É a doença dos 7 detectores de par, em forma de texto de alarme.
 * Aqui: **a primeira carga é o produtor rodando uma vez**.
 *
 * ⚠️ **E ELE RECONCILIA, não só grava.** O que ele deixa de reportar numa rodada é RESOLVIDO —
 * senão o dono conserta o CHEDDAR e o aviso do CHEDDAR fica lá pra sempre, e em duas semanas
 * ele para de abrir o sininho. Trabalho FEITO tem que sair da fila.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { acharPadrao, fraseDoPadrao, type LoteMedido } from '../padrao-de-rendimento'
import { faixaDoSelo, DESVIO_GRAVE } from '@/lib/stock/producao/eficiencia-da-ordem'
import { fichasParaConverter } from '@/lib/stock/producao/fichas-para-converter'
import { fiscalDeOrdens, type FiscalDoLote } from '@/lib/stock/producao/fiscal-dos-lotes'
import type { NovoAviso } from '../tipos'

/**
 * ⚠️⚠️ **O CLIENT VEM POR PARÂMETRO, e isso não é enfeite — foi um BUG MEU pego antes de rodar.**
 * O preview da primeira carga embrulha o produtor num `$transaction` pra desfazer tudo no fim;
 * com o `prisma` GLOBAL cravado aqui dentro, as escritas sairiam **fora** da transação e o
 * "preview" **gravaria de verdade**. É a família do *"preview e confirm discordando"* que custou
 * o import de OFX inteiro — aqui seria um preview que mente sobre não ter gravado.
 */
type Db = PrismaClient | Prisma.TransactionClient

export interface ResumoDaCarga {
  gravados: number
  reabertos: number
  resolvidos: number
  recusados: { motivo: string; titulo: string }[]
}

/** ⭐ quantos lotes pra trás olhar quando se procura padrão — 2 meses cobre receita semanal */
const JANELA_DIAS = 60

/**
 * ⚠️ **GRAVA PELA PORTA ÚNICA e NUNCA derruba o cron.** Aviso recusado pela lei da língua do
 * balcão é **erro MEU** (texto mal escrito no produtor), não motivo pra o juiz noturno morrer
 * no meio e deixar os outros invariantes sem rodar. A recusa entra no resumo com o motivo, e é
 * assim que eu descubro.
 */
async function gravar(a: NovoAviso, r: ResumoDaCarga, db: Db) {
  const v = avaliarLinguaDoBalcao(a)
  if (!v.ok) {
    r.recusados.push({ motivo: v.motivo, titulo: a.titulo })
    return
  }
  const { reaberto } = await registrarAviso(a, db)
  r.gravados++
  if (reaberto) r.reabertos++
}

/**
 * ⭐⭐ (1) PADRÃO DE RENDIMENTO — N lotes seguidos fora, com o NOME de quem fez.
 *
 * ⛔⛔ **É AQUI QUE OS 42 LOTES DO P8 VIRAM POUCOS AVISOS.** O juiz denuncia lote a lote (e
 * continua denunciando no e-mail, que é a auditoria); a central agrupa **por receita** e só
 * fala quando há PADRÃO. Sem isso a central nasceria com 42 linhas e o dono aprenderia a
 * ignorar o sininho na primeira semana — os 111 alarmes falsos de 26/08 em outra roupa.
 */
async function padraoDeRendimento(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  const desde = new Date(Date.now() - JANELA_DIAS * 86400000)

  const desvios = await db.stockProducaoDesvio.findMany({
    where: { companyId, criadoEm: { gte: desde } },
    select: { ordemId: true, conclusaoId: true, pctTeorico: true, criadoEm: true },
    orderBy: { criadoEm: 'asc' },
  })
  if (!desvios.length) {
    await reconciliarOrigem(companyId, 'PADRAO_RENDIMENTO', [], db)
    return
  }

  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, id: { in: [...new Set(desvios.map((d) => d.ordemId))] } },
    select: { id: true, fichaId: true, itemProduzidoId: true },
  })
  const porOrdem = new Map(ordens.map((o) => [o.id, o]))

  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } },
    select: { id: true, nome: true },
  })
  const nomeDoItem = new Map(itens.map((i) => [i.id, i.nome]))

  /**
   * ⛔⛔⛔ **O NOME DE QUEM FEZ VEM DA CONCLUSÃO, NÃO DO DESVIO — defeito meu, medido em prod.**
   *
   * Eu lia `stockProducaoDesvio.criadoPorId` achando que era colaborador. **Medido: ele é id de
   * USUÁRIO** (marcyelle, Yussef, cristian — quem operou o SISTEMA) e só existe em **78 de 400**
   * linhas; nenhum deles casa com `stock_colaborador`. Resultado: os 7 avisos de padrão saíram
   * com *"feitos por sem nome registrado"* — justamente o nome que o dono pediu.
   *
   * ⭐ Quem fez o lote está em `stock_producao_conclusao.colaboradorId` (**353 de 400**: Cristian,
   * Carlisle, nadine, rodrigo, eliane…). É a distinção que esta casa já tinha escrito em 09/09:
   * *"quem CONTOU, não quem abriu a sessão"* — operador do sistema ≠ pessoa que fez o trabalho.
   */
  const conclusoes = await db.stockProducaoConclusao.findMany({
    where: { companyId, id: { in: desvios.map((d) => d.conclusaoId) } },
    select: { id: true, colaboradorId: true },
  })
  const colabDaConclusao = new Map(conclusoes.map((c) => [c.id, c.colaboradorId]))
  const colabs = await db.stockColaborador.findMany({
    where: { companyId },
    select: { id: true, nome: true },
  })
  const nomeDoColab = new Map(colabs.map((c) => [c.id, c.nome]))

  /** agrupa por FICHA — é a receita que tem padrão, não a ordem */
  const porFicha = new Map<string, { nome: string; lotes: LoteMedido[] }>()
  for (const d of desvios) {
    const o = porOrdem.get(d.ordemId)
    if (!o) continue
    const chave = o.fichaId
    const nome = nomeDoItem.get(o.itemProduzidoId) ?? 'receita sem nome'
    if (!porFicha.has(chave)) porFicha.set(chave, { nome, lotes: [] })
    porFicha.get(chave)!.lotes.push({
      ordemId: d.ordemId,
      encerradoEm: d.criadoEm.toISOString(),
      pct: d.pctTeorico,
      quem: (() => {
        const cid = colabDaConclusao.get(d.conclusaoId)
        return cid ? (nomeDoColab.get(cid) ?? null) : null
      })(),
    })
  }

  /**
   * ⛔⛔⛔ **UMA CAUSA, UM ALARME — e a medição em prod é o argumento.** Das **41** receitas com
   * lote medido nos últimos 60 dias, **33 têm o lote declarado na unidade errada** — e nelas o
   * `pctTeorico` **não mede rendimento: mede a ficha quebrada** (é o CHEDDAR a 1027%). Sem esta
   * supressão a central nascia com 33 avisos de "padrão de rendimento" + 1 de ficha **pro mesmo
   * problema**, e o dono iria caçar a mão da cozinha quando o defeito é a unidade do lote.
   *
   * ⭐ É a régua que esta casa já aplica entre P8 e P3 (*"ele CALA o P3 no mesmo lote"*) e entre
   * N1 e N3 no juiz de infra. O aviso da ficha já diz o que fazer; quando o dono converter, o
   * percentual passa a significar algo e o padrão volta a valer sozinho.
   */
  const loteTorto = await fichasComLoteTorto(companyId, db)

  const vivos: string[] = []
  for (const [fichaId, g] of porFicha) {
    if (loteTorto.has(fichaId)) continue
    const p = acharPadrao(g.lotes)
    if (!p) continue
    vivos.push(fichaId)
    const f = fraseDoPadrao(g.nome, p)
    await gravar(
      {
        companyId,
        setor: 'producao',
        /** ⚠️ grandeza impossível é DADO impossível → vermelho sempre; padrão de rendimento de
         *  verdade escala com o tamanho do padrão. */
        severidade: p.grandezaImpossivel || p.seguidos >= 4 ? 'vermelho' : 'ambar',
        titulo: f.titulo,
        corpo: f.corpo,
        oQueFazer: f.oQueFazer,
        acaoRotulo: 'abrir a receita',
        acaoHref: `/empresas/${companyId}/estoque/producao/receitas`,
        origem: 'PADRAO_RENDIMENTO',
        alvo: fichaId,
      },
      r,
      db,
    )
  }
  /** ⭐ receita que voltou pra faixa SAI da central sozinha */
  r.resolvidos += await reconciliarOrigem(companyId, 'PADRAO_RENDIMENTO', vivos, db)
}

/**
 * ⭐⭐⭐ (2) AS FICHAS COM O LOTE NA UNIDADE ERRADA — **UM aviso agrupado**, não 37.
 *
 * ⛔⛔ **DUAS CORREÇÕES MEDIDAS NA PREVIEW EM PROD, as duas defeitos MEUS:**
 *
 * **(a) ESCOPO — eu varria TODAS as fichas ativas (38) em vez das de PRODUÇÃO (37).** A sobra
 * era um invólucro de CARDÁPIO, e nele a pergunta não existe: produto final MONTA na venda,
 * não tem lote. O aviso saía como *"Não cria ordem de Pizza congelada de calabresa"* — uma
 * ordem que ninguém cria. ⭐ **A régua já tinha DONO** (`fichasParaConverter`, a fila de
 * conversão de 04/10, com o filtro `comoConsome === 'ESTOCADO'` e o motivo escrito), e eu
 * escrevi a segunda derivação. Agora o produtor **LÊ a fila** — e isso também garante de graça
 * o que a prova de 04/10 mediu: *"o M5 acusa 37 · a LISTA oferece 37 · divergência 0"*.
 *
 * **(b) UM AVISO, NÃO 37.** A ordem do dono sobre os 42 lotes do P8 era *"como **UM** aviso de
 * padrão agrupado"*, e a mesma régua vale aqui: 37 linhas vermelhas enterrariam a ordem parada
 * e os padrões de rendimento, e o dono aprenderia a ignorar o sininho na primeira semana. O
 * aviso **NOMEIA as piores** no corpo (o CHEDDAR entre elas, que foi o caso que ele citou) e o
 * botão leva pra **fila de conversão**, que é a tela que existe justamente pra varrer as 37
 * numa sentada, com progresso 37→0.
 */
async function fichaNaoComparavel(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  const fila = await fichasParaConverter(companyId, db)
  if (!fila.pendentes.length) {
    r.resolvidos += await reconciliarOrigem(companyId, 'FICHA_SEM_COMPARACAO', [], db)
    return
  }

  /**
   * ⚠️ As "piores" são as de MAIOR distorção medida (rendimento medido mais longe de 1): é onde
   * criar uma ordem hoje separa material mais errado. Ficha sem lote medido vai pro fim — sem
   * medição não dá pra ordenar por estrago, e inventar uma ordem seria chutar.
   */
  const piores = [...fila.pendentes]
    .sort((a, b) => Math.abs((b.medido ?? 1) - 1) - Math.abs((a.medido ?? 1) - 1))
    .slice(0, 3)
    .map((f) => (f.medido ? `${f.nomeProduto} (${Math.round(f.medido * 100)}%)` : f.nomeProduto))

  const n = fila.pendentes.length
  await gravar(
    {
      companyId,
      setor: 'producao',
      severidade: 'vermelho',
      titulo: `Corrija o lote de ${n} receita(s) antes de criar ordem delas`,
      corpo:
        `${n} de ${fila.total} receitas declaram o lote numa unidade diferente da que o produto se ` +
        `conta. Se alguém pedir 10, o sistema separa material pra bem menos. As piores: ${piores.join(' · ')}.`,
      oQueFazer:
        'Abra a fila de conversão e conserte quantas unidades saem de uma receita — ela mostra o antes e o depois, e digitar o lote de hoje não mexe no estoque.',
      acaoRotulo: `converter as ${n}`,
      acaoHref: `/empresas/${companyId}/estoque/producao/receitas`,
      origem: 'FICHA_SEM_COMPARACAO',
      /** ⭐ alvo FIXO: é UM aviso da empresa, então ele atualiza em vez de nascer de novo */
      alvo: 'fila-de-conversao',
    },
    r,
    db,
  )
  r.resolvidos += await reconciliarOrigem(companyId, 'FICHA_SEM_COMPARACAO', ['fila-de-conversao'], db)
}

/** ⭐ as fichas cujo % medido NÃO é rendimento (é a ficha quebrada) — ver o produtor (1) */
async function fichasComLoteTorto(companyId: string, db: Db): Promise<Set<string>> {
  const fila = await fichasParaConverter(companyId, db)
  return new Set(fila.pendentes.map((f) => f.fichaId))
}

/**
 * ⭐⭐ (3) ORDEM PARADA — a linguagem CORAL da ordem atrasada (a mesma da home).
 *
 * ⚠️ O corpo diz o que o dono precisa saber pra decidir: *"o insumo saiu e não virou produto"*.
 * E o aviso só nasce depois de 24h — ordem aberta durante o turno é a cozinha trabalhando, não
 * um problema (foi assim que o P2 nasceu, e a régua é a dele).
 */
async function ordemParada(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  const abertas = await db.stockProductionOrder.findMany({
    where: { companyId, estado: { in: ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'] } },
    select: { id: true, estado: true, atualizadoEm: true, dataProducao: true, itemProduzidoId: true },
  })
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: abertas.map((o) => o.itemProduzidoId) } },
    select: { id: true, nome: true },
  })
  const nome = new Map(itens.map((i) => [i.id, i.nome]))

  const vivos: string[] = []
  for (const o of abertas) {
    const horas = (Date.now() - o.atualizadoEm.getTime()) / 3_600_000
    if (horas <= 24) continue
    const dias = Math.floor(horas / 24)
    vivos.push(o.id)
    await gravar(
      {
        companyId,
        setor: 'producao',
        severidade: 'coral',
        titulo: `Feche a ordem de ${nome.get(o.itemProduzidoId) ?? 'produção'} que está parada`,
        corpo:
          `Essa ordem está parada há ${dias === 0 ? 'mais de um dia' : `${dias} dia(s)`} — ` +
          `o insumo saiu da prateleira e não virou produto.`,
        oQueFazer: 'Abra a ordem e escolha: concluir com o que saiu, cancelar e devolver, ou continuar depois.',
        acaoRotulo: 'abrir a ordem',
        acaoHref: `/empresas/${companyId}/estoque/producao/${o.id}`,
        origem: 'ORDEM_PARADA',
        alvo: o.id,
      },
      r,
      db,
    )
  }
  r.resolvidos += await reconciliarOrigem(companyId, 'ORDEM_PARADA', vivos, db)
}

/**
 * ⭐⭐ (4) LOTE DE GRANDEZA IMPOSSÍVEL — o lote que destoa em ORDEM DE GRANDEZA.
 *
 * ⚠️⚠️ **E ESTE É A EXCEÇÃO À REGRA DO PADRÃO, com o motivo escrito.** O dono disse *"NUNCA por
 * lote isolado — variação de carne é natural"*, e isso vale pra variação: 80%, 120%, 140%. Um
 * lote a **1027%** não é variação, é **dado impossível** (a família do `22864` que eram 22,864
 * kg, 19/09) — e ele já envenena o custo médio do item no mesmo instante. Deixá-lo esperando
 * três repetições seria esperar o erro virar norma, que é exatamente o que o estorno de
 * conclusão podre existe pra impedir.
 */
async function loteDeGrandezaImpossivel(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  /** ⭐ 10× a faixa grave — bem acima de qualquer variação de cozinha */
  const TETO = 100 * (1 + DESVIO_GRAVE) * 10
  const desde = new Date(Date.now() - JANELA_DIAS * 86400000)
  const desvios = await db.stockProducaoDesvio.findMany({
    where: { companyId, criadoEm: { gte: desde } },
    select: { ordemId: true, pctTeorico: true },
  })
  /** ⛔ mesma supressão: num lote de ficha torta o % é lixo, e o aviso da ficha já cobre */
  const loteTorto = await fichasComLoteTorto(companyId, db)
  const ordensDoPeriodo = await db.stockProductionOrder.findMany({
    where: { companyId, id: { in: [...new Set(desvios.map((d) => d.ordemId))] } },
    select: { id: true, fichaId: true },
  })
  const fichaDaOrdem = new Map(ordensDoPeriodo.map((o) => [o.id, o.fichaId]))
  const fora = desvios.filter(
    (d) =>
      faixaDoSelo(d.pctTeorico) === 'EXTREMO' &&
      d.pctTeorico >= TETO &&
      !loteTorto.has(fichaDaOrdem.get(d.ordemId) ?? ''),
  )

  const ordens = fora.length
    ? await db.stockProductionOrder.findMany({
        where: { companyId, id: { in: fora.map((d) => d.ordemId) } },
        select: { id: true, itemProduzidoId: true },
      })
    : []
  const itens = ordens.length
    ? await db.stockItem.findMany({
        where: { companyId, id: { in: ordens.map((o) => o.itemProduzidoId) } },
        select: { id: true, nome: true },
      })
    : []
  const nome = new Map(itens.map((i) => [i.id, i.nome]))
  const itemDaOrdem = new Map(ordens.map((o) => [o.id, o.itemProduzidoId]))

  const vivos: string[] = []
  for (const d of fora) {
    vivos.push(d.ordemId)
    const n = nome.get(itemDaOrdem.get(d.ordemId) ?? '') ?? 'o produto'
    await gravar(
      {
        companyId,
        setor: 'producao',
        severidade: 'vermelho',
        titulo: `Confira o lote de ${n} — saiu ${Math.round(d.pctTeorico)}% do esperado`,
        corpo:
          `Um lote de ${n} rendeu ${Math.round(d.pctTeorico)}% do que a ficha promete. ` +
          `Isso não é variação de cozinha: ou a quantidade foi digitada em outra unidade, ou a ficha está errada.`,
        oQueFazer: `Abra a ordem e confira quantas unidades saíram de verdade — e em qual unidade elas foram contadas.`,
        acaoRotulo: 'abrir a ordem',
        acaoHref: `/empresas/${companyId}/estoque/producao/${d.ordemId}`,
        origem: 'LOTE_GRANDEZA',
        alvo: d.ordemId,
      },
      r,
      db,
    )
  }
  r.resolvidos += await reconciliarOrigem(companyId, 'LOTE_GRANDEZA', vivos, db)
}

/**
 * ⭐⭐⭐ (5) O FISCAL NO SININHO — *"o declarado cabe no material separado?"* (04/10/2026).
 *
 * **Ordem do dono:** *"no SININHO quando vira padrão ou caso impossível (>120% físico):
 * 'NATHALIA declarou 144 com material pra ~51 — confere o lançamento', com link pra ordem"*.
 *
 * ⛔⛔ **CASO IMPOSSÍVEL É A EXCEÇÃO DECLARADA À REGRA DO PADRÃO — e o dono a nomeou.** A régua
 * geral é *"nunca por lote isolado, variação de carne é natural"*; mas **declarar 144 unidades
 * com material pra 51 não é variação, é lançamento errado**, e ele já envenenou o custo médio
 * do item no instante em que foi gravado (a família do `22864` que eram 22,864 kg). Esperar três
 * repetições aqui seria esperar o erro virar norma.
 *
 * ⭐ **E o aviso NOMEIA QUEM DECLAROU**, como ele pediu — a frase é pra o dono conversar com a
 * pessoa, não pra ele adivinhar quem foi.
 *
 * ⚠️ **ZERO CONTA NOVA:** a decisão é do `fiscalDoDeclarado` (que deriva de `insumoDoPedido`);
 * este produtor só traduz em frase e grava.
 */
async function fiscalDoDeclaradoNoSininho(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  const desde = new Date(Date.now() - JANELA_DIAS * 86400000)
  const conclusoes = await db.stockProducaoConclusao.findMany({
    where: { companyId, criadoEm: { gte: desde } },
    select: { ordemId: true, colaboradorId: true, criadoEm: true },
    orderBy: { criadoEm: 'asc' },
  })
  if (!conclusoes.length) {
    r.resolvidos += await reconciliarOrigem(companyId, 'FISCAL_DECLARADO', [], db)
    return
  }

  const fiscais = await fiscalDeOrdens(companyId, conclusoes.map((c) => c.ordemId), db)
  const colabs = await db.stockColaborador.findMany({ where: { companyId }, select: { id: true, nome: true } })
  const nomeDoColab = new Map(colabs.map((c) => [c.id, c.nome]))
  /** ⭐ quem declarou: a ÚLTIMA conclusão da ordem é quem fechou o número */
  const quemDaOrdem = new Map<string, string | null>()
  const quandoDaOrdem = new Map<string, Date>()
  for (const c of conclusoes) {
    quemDaOrdem.set(c.ordemId, c.colaboradorId ? (nomeDoColab.get(c.colaboradorId) ?? null) : null)
    quandoDaOrdem.set(c.ordemId, c.criadoEm)
  }

  /**
   * ⛔⛔⛔ **UMA CAUSA, UM ALARME — e o número medido em prod é o argumento.** A 1ª versão deste
   * produtor emitia **90 avisos** na Caçula: um por ordem impossível da janela. Isso não é
   * central, é enxurrada — *alarme falso repetido é como um alarme morre* (os 111 do juiz de
   * vendas, o N1 que não empilha sobre o N3).
   *
   * Duas réguas, as duas já usadas pelos vizinhos deste arquivo:
   * 1. **ficha com o lote na unidade errada SAI** — ali o `permitido` não mede lançamento, mede
   *    a ficha quebrada (é o CHEDDAR que "permite ~0,152 e declarou 2"). O aviso da fila de
   *    conversão já diz o que fazer; este em cima mandaria o dono conferir a mão da cozinha.
   * 2. **repetiu na MESMA receita = PADRÃO, e padrão é UM aviso** — exatamente as duas formas
   *    que o dono nomeou (*"quando vira padrão ou caso impossível"*). Caso isolado continua
   *    sendo um aviso da ORDEM, com o nome de quem declarou e o link direto.
   */
  const loteTorto = await fichasComLoteTorto(companyId, db)
  const porFicha = new Map<string, FiscalDoLote[]>()
  for (const f of fiscais.values()) {
    if (!f.impossivel || f.permitido == null) continue
    if (loteTorto.has(f.fichaId)) continue
    porFicha.set(f.fichaId, [...(porFicha.get(f.fichaId) ?? []), f])
  }

  const vivos: string[] = []
  for (const [fichaId, lotes] of porFicha) {
    /** ⭐ o mais RECENTE é o que o dono vai abrir — ordenar por quando a conclusão foi lançada */
    const ord = [...lotes].sort(
      (a, b) => (quandoDaOrdem.get(b.ordemId)?.getTime() ?? 0) - (quandoDaOrdem.get(a.ordemId)?.getTime() ?? 0),
    )
    const ultimo = ord[0]
    const un = ultimo.unidade

    if (ord.length === 1) {
      const quem = quemDaOrdem.get(ultimo.ordemId)
      /** ⚠️ sem nome a frase NÃO inventa pessoa — ela fala do lote (a lição de 04/10) */
      const sujeito = quem ? `${quem} declarou` : 'Foram declaradas'
      const gargalo = ultimo.gargalo ? ` (o limite é ${ultimo.gargalo})` : ''
      vivos.push(ultimo.ordemId)
      await gravar(
        {
          companyId,
          setor: 'producao',
          severidade: 'vermelho',
          titulo: `Confere o lançamento de ${ultimo.produto} — declarou mais do que o material dava`,
          corpo:
            `${sujeito} ${ultimo.declarado} ${un} com material pra ~${ultimo.permitido} ${un}${gargalo}. ` +
            `Isso não é rendimento bom: ou saiu unidade que ninguém contou, ou o consumo não foi lançado inteiro.`,
          oQueFazer: `Abra a ordem e confira quantas ${un} saíram de verdade — e se todo o material usado foi lançado.`,
          acaoRotulo: 'abrir a ordem',
          acaoHref: `/empresas/${companyId}/estoque/producao/${ultimo.ordemId}`,
          origem: 'FISCAL_DECLARADO',
          alvo: ultimo.ordemId,
        },
        r,
        db,
      )
      continue
    }

    /** ⭐ PADRÃO: a receita repete o descompasso — e aí quem se conserta é a RECEITA, não o lote */
    const quem = [...new Set(ord.map((l) => quemDaOrdem.get(l.ordemId)).filter((n): n is string => !!n))]
    const nomes = quem.length === 0 ? '' : quem.length <= 2 ? ` (${quem.join(' e ')})` : ` (${quem.length} pessoas)`
    vivos.push(ultimo.ordemId)
    await gravar(
      {
        companyId,
        setor: 'producao',
        severidade: 'vermelho',
        titulo: `Confere a receita de ${ultimo.produto} — ${ord.length} lotes declararam mais do que o material dava`,
        corpo:
          `Em ${ord.length} lotes dos últimos ${JANELA_DIAS} dias${nomes} saiu mais produto do que o material ` +
          `separado permitia — no último, ${ultimo.declarado} ${un} com material pra ~${ultimo.permitido} ${un}` +
          `${ultimo.gargalo ? ` (o limite é ${ultimo.gargalo})` : ''}. Repetir é sinal de dose da ficha acima do real, ` +
          `não de um lançamento torto.`,
        oQueFazer: `Abra o último lote, confira quantas ${un} saíram de verdade, e ajuste a dose da receita se ela estiver acima do real.`,
        acaoRotulo: 'abrir o último lote',
        acaoHref: `/empresas/${companyId}/estoque/producao/${ultimo.ordemId}`,
        origem: 'FISCAL_DECLARADO',
        /** ⚠️ alvo é a FICHA: o padrão é dela, e assim ele não briga com o aviso do lote isolado */
        alvo: `ficha:${fichaId}`,
      },
      r,
      db,
    )
  }
  r.resolvidos += await reconciliarOrigem(
    companyId,
    'FISCAL_DECLARADO',
    [...vivos, ...[...porFicha.keys()].map((f) => `ficha:${f}`)],
    db,
  )
}

/**
 * ⭐⭐⭐ A PORTA: roda os 5 produtores de produção pra uma empresa.
 *
 * ⚠️ Chamada pelo cron das 3h **e** pela primeira carga — é a mesma função, e é por isso que a
 * central nasce útil sem um script com texto duplicado.
 */
export async function produzirAvisosDeProducao(
  companyId: string,
  db: Db = prisma,
): Promise<ResumoDaCarga> {
  const r: ResumoDaCarga = { gravados: 0, reabertos: 0, resolvidos: 0, recusados: [] }
  await padraoDeRendimento(companyId, r, db)
  await fichaNaoComparavel(companyId, r, db)
  await ordemParada(companyId, r, db)
  await loteDeGrandezaImpossivel(companyId, r, db)
  await fiscalDoDeclaradoNoSininho(companyId, r, db)
  return r
}
