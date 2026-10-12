/**
 * ⭐⭐⭐ A AUTO-CONVERSÃO DAS NEUTRAS — *"o sistema resolve sozinho"* (11/10/2026).
 *
 * **Ordem do dono (item 1):** *"Para cada ficha da fila: provar neutralidade — separação
 * IDÊNTICA AO CENTAVO em TODOS os componentes, antes × depois. Δ == 0 em tudo → converte SOZINHO
 * o rótulo («rende 1 UN»). Qualquer Δ ≠ 0 → NÃO TOCA."*
 *
 * ═══ ⭐⭐ POR QUE ISTO PODE SER AUTOMÁTICO (a lei de 03/10, por escrito) ═══
 *
 * A separação é `pedido ÷ loteBase × dose`; depois da conversão é `pedido ÷ 1 × (dose ÷ U)`. As
 * duas são iguais **se e somente se `U == loteBase`**. Ou seja:
 *
 * > **converter é NEUTRO exatamente quando o NÚMERO do lote já estava certo e só a UNIDADE
 * > estava errada** — que é o caso de uma ficha `rende 1 KG` num produto contado em UN.
 *
 * ⛔⛔ **E MESMO ASSIM A NEUTRALIDADE É MEDIDA, componente por componente, pela PORTA DA
 * SEPARAÇÃO (`insumoDoPedido`).** Conferir a conversão contra a álgebra que a gerou seria o
 * invariante circular de 28/08 — *"ele daria verde sempre, inclusive com o buraco aberto"*. O
 * que vale é rodar a mesma função que a cozinha roda, antes e depois, e exigir diferença ZERO.
 *
 * ⚠️ **E em VÁRIOS pedidos, não num só:** `round4` do insumo e `round6` da dose só mostram a
 * cara em certas escalas — um pedido único poderia esconder divergência que aparece em 137,5.
 * Foi assim que a `MAIONESE` se revelou NÃO-neutra (Δ 0,0003 KG, de arredondamento).
 *
 * ═══ ⚠️ O QUE A AUTO-CONVERSÃO **NÃO** FAZ ═══
 *
 * Ela **não declara rendimento nenhum**. Ficha `rende 20 KG` com produto em UN não vira
 * *"rende 20 UN"* (isso seria afirmar um rendimento que ninguém mediu) nem *"rende 1 UN"* (isso
 * multiplicaria o material por 20). Essas são as **pendentes**, e o número delas é do dono.
 *
 * ⛔ Nem toca em MEDIÇÃO: o rendimento medido é ESPELHO (03/10) e **não entra em conta nenhuma**.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { converterLote, type ComponenteDaFicha } from './converter-lote'
import { insumoDoPedido } from './escala-da-ordem'
import { fichasParaConverter, type FichaParaConverter } from './fichas-para-converter'
import { loteEhComparavel } from './lote-comparavel'
import { comoConsome } from '../explodir-receita'
import { aplicarConversaoDeLote } from './aplicar-conversao'
import { registrarAviso } from '@/lib/avisos/central'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⚠️ Os pedidos da prova: inteiro pequeno, inteiro grande, fração e um que não divide redondo.
 * **Não é enfeite** — cada um ataca um arredondamento diferente da cadeia `dose → escala →
 * insumo`. O `137,5` é o que mais já pegou nesta casa.
 */
/** ⭐ a origem do RESUMO — distinta do aviso por ficha (`RENDIMENTO_PENDENTE`) de propósito */
export const ORIGEM_DO_RESUMO = 'ROTULO_CORRIGIDO'

export const PEDIDOS_DA_PROVA = [1, 7, 30, 80, 137.5, 1000] as const

export interface ProvaDeComponente {
  itemId: string
  nome: string
  unidade: string
  doseAntes: number
  doseDepois: number
  /** a maior diferença de separação vista entre os pedidos da prova */
  piorDelta: number
}

export interface AvaliacaoDaAuto {
  fichaId: string
  nomeProduto: string
  rotuloAntes: string
  rotuloDepois: string
  /** quantas unidades do produto 1 receita passa a dizer que rende */
  unidadesPorReceita: number
  /** ⭐ `true` só quando TODO componente tem Δ 0 em TODOS os pedidos da prova */
  neutra: boolean
  piorDelta: number
  componentes: ProvaDeComponente[]
  /** por que ela NÃO é neutra — `null` quando é */
  porQueNao: string | null
}

/**
 * PURA. A proposta automática e a PROVA dela.
 *
 * ⭐ A proposta é sempre `U = loteBase` (*"o número estava certo, a unidade não"*). Com
 * `loteBase = 1` as doses ficam intactas e o rótulo passa a dizer `rende 1 <unidade do produto>`.
 */
export function avaliarAutoConversao(f: {
  fichaId: string
  nomeProduto: string
  loteBase: number
  unidadeLoteBase: string
  unidadeProduto: string
  componentes: ComponenteDaFicha[]
}): AvaliacaoDaAuto {
  const U = f.loteBase
  const base = {
    fichaId: f.fichaId,
    nomeProduto: f.nomeProduto,
    rotuloAntes: `rende ${f.loteBase} ${f.unidadeLoteBase}`,
    unidadesPorReceita: U,
  }
  const conv = converterLote(
    { loteBase: f.loteBase, unidadeLoteBase: f.unidadeLoteBase, unidadeProduto: f.unidadeProduto, componentes: f.componentes },
    U,
  )
  if (!conv) {
    return {
      ...base,
      rotuloDepois: base.rotuloAntes,
      neutra: false,
      piorDelta: Infinity,
      componentes: [],
      porQueNao: 'o lote declarado não é um número utilizável — não há o que converter sem o dono dizer o rendimento.',
    }
  }

  const componentes: ProvaDeComponente[] = []
  let pior = 0
  for (const c of conv.componentes) {
    let piorDoComp = 0
    for (const pedido of PEDIDOS_DA_PROVA) {
      const antes = insumoDoPedido({ pedido, loteBase: f.loteBase }, c.qtdPlanejada)
      const depois = insumoDoPedido({ pedido, loteBase: conv.loteBaseNovo }, c.qtdNova)
      // ⛔ `null` de qualquer lado é prova que não dá pra fazer — não é "igual"
      if (antes == null || depois == null) { piorDoComp = Infinity; break }
      piorDoComp = Math.max(piorDoComp, Math.abs(antes - depois))
    }
    pior = Math.max(pior, piorDoComp)
    componentes.push({
      itemId: c.itemId, nome: c.nome, unidade: c.unidade,
      doseAntes: c.qtdPlanejada, doseDepois: c.qtdNova, piorDelta: piorDoComp,
    })
  }

  const neutra = pior === 0
  return {
    ...base,
    rotuloDepois: `rende ${conv.loteBaseNovo} ${conv.unidadeLoteBaseNova}`,
    neutra,
    piorDelta: pior,
    componentes,
    porQueNao: neutra
      ? null
      : `a separação MUDARIA (até ${pior === Infinity ? '∞' : pior} na unidade do componente) — ` +
        'esta ficha precisa do rendimento que só o dono sabe.',
  }
}

export interface ResumoDaAutoConversao {
  /** quantas fichas de produção a empresa tem */
  total: number
  /** quantas já declaravam o lote na unidade do produto antes desta rodada */
  jaCoerentes: number
  convertidas: AvaliacaoDaAuto[]
  /** as que ficaram pro dono, com o motivo de cada uma */
  pendentes: (AvaliacaoDaAuto & { medido: number | null; lotes: number })[]
}

export class AutoConversaoError extends Error {}

/**
 * ⛔⛔ O GUARD DO ITEM 1: **auto com Δ≠0 = RECUSA.**
 *
 * ⚠️ Ele existe aqui, e não só no laço, porque o dia em que alguém chamar a aplicação por outro
 * caminho (um script, uma rota nova) a trava tem que vir junto — *disciplina que depende de
 * lembrar é disciplina que a próxima porta esquece* (REGRA 5).
 */
export function exigirNeutralidade(a: AvaliacaoDaAuto): void {
  if (!a.neutra) {
    throw new AutoConversaoError(
      `AUTO RECUSADA em “${a.nomeProduto}”: ${a.porQueNao} ` +
      'Conversão automática só existe quando a separação não se move — o resto é decisão do dono.',
    )
  }
}

/**
 * Converte SOZINHO o rótulo das fichas comprovadamente neutras.
 *
 * ⛔ Grava pelo `aplicarConversaoDeLote` — a porta única, que versiona pelo `atualizarFicha` e
 * **re-avalia dentro do gesto**. Um `stockFichaVersao.create` aqui seria a 2ª porta de gravação
 * de receita (a cicatriz do `PAGAMENTO_EMPRESTIMO` do import, 11/09).
 *
 * ⚠️ `userId` é o RASTRO: a conversão automática passa `null`, e o que identifica o sistema é a
 * versão nova sem autor + o resumo no sininho. Inventar um usuário seria assinar em nome de
 * alguém que não clicou.
 */
export async function autoConverterNeutras(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<ResumoDaAutoConversao> {
  const fila = await fichasParaConverter(companyId, db)
  const convertidas: AvaliacaoDaAuto[] = []
  const pendentes: (AvaliacaoDaAuto & { medido: number | null; lotes: number })[] = []

  for (const f of fila.pendentes) {
    const a = avaliarAutoConversao({
      fichaId: f.fichaId, nomeProduto: f.nomeProduto, loteBase: f.loteBase,
      unidadeLoteBase: f.unidadeLoteBase, unidadeProduto: f.unidadeProduto, componentes: f.componentes,
    })
    if (!a.neutra) { pendentes.push({ ...a, medido: f.medido, lotes: f.lotes }); continue }
    exigirNeutralidade(a) // ⛔ cinto sobre o suspensório: nunca aplica o que não provou
    await aplicarConversaoDeLote(companyId, f.fichaId, a.unidadesPorReceita, null, db)
    convertidas.push(a)
  }

  /**
   * ⭐⭐ UM RESUMO NO SININHO — *"corrigi N rótulos — nada mudou na prateleira"* (item 1).
   *
   * ⛔⛔ **UM, não N.** O aviso por ficha é do item 2 (lá cada uma espera um número DIFERENTE do
   * dono, e o gesto é por ficha). Aqui o sistema já resolveu: 36 sininhos pra dizer *"não mudou
   * nada"* seria a enxurrada que mata o sininho (os 111 alarmes falsos de 26/08).
   *
   * ⭐ **AZUL, nunca âmbar:** nada pede olho — a prateleira não se moveu, e a prova disso é o
   * Δ 0 medido pela porta da separação. Âmbar aqui treinaria o dono a ignorar âmbar.
   *
   * ⚠️ **FAIL-SOFT, e DEPOIS de converter:** a conversão já está gravada quando isto roda; um
   * problema na central de avisos não pode desfazê-la nem derrubar o gesto. ⚠️ E o alvo carrega
   * a CONTAGEM: uma rodada futura que converta outras fichas ganha o seu próprio resumo, em vez
   * de reabrir este e misturar dois lotes num aviso só.
   */
  if (convertidas.length) {
    try {
      const nomes = convertidas.slice(0, 3).map((c) => c.nomeProduto).join(', ')
      const resto = convertidas.length - Math.min(3, convertidas.length)
      await registrarAviso({
        companyId,
        setor: 'gerencia',
        severidade: 'azul',
        titulo: `Confere os ${convertidas.length} rótulos de rendimento que eu corrigi`,
        corpo:
          `${convertidas.length} ficha${convertidas.length > 1 ? 's' : ''} declarava${convertidas.length > 1 ? 'm' : ''} ` +
          `o rendimento numa unidade que não era a do produto (${nomes}${resto > 0 ? ` e outras ${resto}` : ''}). ` +
          'Troquei só o rótulo, e provei antes de mexer: a separação de cada componente dá o ' +
          'mesmo material de antes, ao centavo, em seis tamanhos de pedido. Nada mudou na prateleira.',
        oQueFazer:
          'Confira na lista de receitas se o rendimento de cada uma ficou do jeito que você espera — ' +
          'as versões antigas continuam no histórico, e as ordens já feitas não mudaram.',
        acaoRotulo: 'ver a lista de receitas',
        acaoHref: `/empresas/${companyId}/estoque/producao/receitas`,
        origem: ORIGEM_DO_RESUMO,
        alvo: `auto:${convertidas.length}`,
      }, db)
    } catch {
      // ⚠️ aviso é CANAL, nunca o gesto: a conversão está gravada e não se desfaz por isto
    }
  }

  return { total: fila.total, jaCoerentes: fila.coerentes, convertidas, pendentes }
}

/**
 * ⭐ As que esperam o número DO DONO — a leitura que o aviso e a página da ordem consomem.
 *
 * ⛔⛔ **Ela devolve SÓ as não-neutras, e isso é o ponto:** ficha neutra ainda na fila é
 * trabalho do SISTEMA (a próxima rodada da auto converte sozinha), não pendência do dono.
 * Listá-la cobraria dele um gesto que ele não precisa dar — e *fila que cobra o que já foi
 * resolvido é como o dono aprende a não olhar a fila* (a régua do IGNORAR do cardápio, 14/09).
 */
export async function rendimentosPendentes(
  companyId: string,
  db: Db = defaultPrisma,
): Promise<(FichaParaConverter & { porQueNao: string })[]> {
  const fila = await fichasParaConverter(companyId, db)
  const out: (FichaParaConverter & { porQueNao: string })[] = []
  for (const f of fila.pendentes) {
    const a = avaliarAutoConversao({
      fichaId: f.fichaId, nomeProduto: f.nomeProduto, loteBase: f.loteBase,
      unidadeLoteBase: f.unidadeLoteBase, unidadeProduto: f.unidadeProduto, componentes: f.componentes,
    })
    if (a.neutra) continue
    out.push({ ...f, porQueNao: a.porQueNao! })
  }
  return out
}

/**
 * ⭐⭐ ESTA ficha espera o número do dono? — a pergunta que a PÁGINA DA ORDEM faz (item 2b).
 *
 * ⛔⛔ **RESOLVE POR ID, nunca filtrando a lista inteira.** `fichasParaConverter` tem um laço com
 * 4 consultas POR FICHA — com 190 fichas são ~760 round-trips, e esta pergunta é feita em TODA
 * abertura de ordem, que é tela de todo dia. É a doença dos 4.909 ms de 28/09, e a cura é a
 * mesma de 05/10/16/09/19/09: *quem precisa de UMA linha específica resolve por ID*.
 *
 * ⚠️ A régua é a MESMA (`loteEhComparavel` + `avaliarAutoConversao`) — o que muda é o recorte,
 * nunca a decisão. Uma segunda régua aqui faria a ordem dizer *"falta o rendimento"* sobre uma
 * ficha que a fila considera resolvida.
 */
export async function fichaEsperaRendimento(
  companyId: string,
  fichaId: string,
  db: Db = defaultPrisma,
): Promise<{ espera: boolean; porQue: string | null }> {
  const f = await db.stockFicha.findFirst({
    where: { id: fichaId, companyId },
    select: { id: true, tipoProduto: true, itemProduzidoId: true, versaoAtual: true, ativo: true },
  })
  // ⚠️ ficha inativa/invólucro de cardápio não espera nada — é o MESMO escopo do M5
  if (!f || !f.ativo || comoConsome(f.tipoProduto) !== 'ESTOCADO') return { espera: false, porQue: null }

  const [it, v] = await Promise.all([
    db.stockItem.findFirst({ where: { companyId, id: f.itemProduzidoId }, select: { nome: true, unidadeControle: true } }),
    db.stockFichaVersao.findFirst({
      where: { companyId, fichaId, versao: f.versaoAtual },
      select: { id: true, loteBase: true, unidadeLoteBase: true },
    }),
  ])
  // ⚠️ sem o produto ou sem a versão não dá pra comparar nada — e "não sei" nunca vira "falta"
  if (!it || !v) return { espera: false, porQue: null }
  if (loteEhComparavel(v.unidadeLoteBase, it.unidadeControle)) return { espera: false, porQue: null }

  const comps = await db.stockFichaComponente.findMany({
    where: { companyId, versaoId: v.id }, orderBy: { posicao: 'asc' },
    select: { itemId: true, qtdPlanejada: true, unidade: true },
  })
  const a = avaliarAutoConversao({
    fichaId,
    nomeProduto: it.nome,
    loteBase: v.loteBase,
    unidadeLoteBase: v.unidadeLoteBase,
    unidadeProduto: it.unidadeControle,
    // ⚠️ o nome do componente não entra na decisão — só a dose; buscar os nomes aqui seria uma
    // consulta a mais numa tela de todo dia por um dado que ninguém lê
    componentes: comps.map((c) => ({ itemId: c.itemId, nome: '', unidade: c.unidade, qtdPlanejada: c.qtdPlanejada })),
  })
  /**
   * ⛔⛔ NEUTRA NÃO ESPERA O DONO — é trabalho do SISTEMA (a auto converte sozinha na próxima
   * rodada). A ordem perguntaria um número que ele não precisa dizer, e o gesto seria cobrado
   * duas vezes: aqui e no sininho que nunca vai nascer.
   */
  if (a.neutra) return { espera: false, porQue: null }
  return { espera: true, porQue: a.porQueNao }
}
