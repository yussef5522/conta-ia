/**
 * ⛔⛔⛔ O AVISO DE INVESTIGAÇÃO DO ESTOQUE (05/10/2026) — **o negativo não morre calado.**
 *
 * **Ordem do dono:** *"Contagem sobre item negativo gera aviso no SININHO (setor estoque,
 * língua do balcão): «O [item] estava negativo (−X) antes da tua contagem — o sistema aceitou
 * teus N, e a causa do negativo merece olhada: [ver o histórico do item →]» — com a régua
 * anti-spam (origem+alvo único; se a causa já tem aviso, ex. ficha na fila de conversão, NÃO
 * duplica: uma causa, um alarme)."*
 *
 * ⭐⭐ **ESTA É A METADE QUE FALTAVA PRA A LEI PODER EXISTIR.** A recusa de 22/09 tinha um
 * argumento bom — *"contar por cima ENTERRA o lote que ninguém lançou"* — e ele só deixou de
 * valer porque o enterro passou a ser **impossível**: a contagem entra, e o negativo sai daqui
 * com nome, número e um link. ⛔ Sem este produtor, a lei nova seria exatamente o enterro que
 * a recusa temia.
 *
 * ⚠️⚠️ **E O FATO TEM UMA FONTE SÓ:** `stock_contagem_negativo`, gravado na MESMA transação da
 * contagem. Derivar *"este item estava negativo"* de novo aqui (relendo o ledger) seria a 2ª
 * resposta pra mesma pergunta, e ela divergiria no 1º caso de borda — a doença do B1. Aqui o
 * produtor **traduz um fato gravado**, nunca recalcula.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem, avisosAbertos } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { rotuloDoMotivo } from '@/lib/stock/contagem-ancora'
import type { NovoAviso } from '../tipos'

/**
 * ⚠️ O client vem por PARÂMETRO — a lição de 04/09: com o `prisma` global cravado aqui, o
 * preview que embrulha o produtor num `$transaction` gravaria **de verdade**.
 */
type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM = 'CONTAGEM_SOBRE_NEGATIVO'

/**
 * ⚠️ Quanto tempo pra trás olhar. A investigação é sobre o que acabou de acontecer; aviso de
 * um negativo contado há três meses é arqueologia, e **fila que cobra o que já passou é como o
 * dono aprende a não abrir o sininho**.
 */
export const JANELA_DIAS = 30

export interface ResumoDoEstoque {
  gravados: number
  reabertos: number
  resolvidos: number
  calados: { item: string; porque: string }[]
  recusados: { motivo: string; titulo: string }[]
}

/**
 * ⛔⛔ **A RÉGUA ANTI-SPAM: "UMA CAUSA, UM ALARME".**
 *
 * Se o item já tem aviso aberto que explica o negativo — a **ficha na fila de conversão**
 * (`FICHA_SEM_COMPARACAO`), o **fiscal do declarado** (`FISCAL_DECLARADO`), a **grandeza do
 * lote** (`LOTE_GRANDEZA`) —, este aviso **não nasce**: ele mandaria o dono olhar a mesma coisa
 * de novo, por outra porta.
 *
 * ⚠️ É a mesma supressão que o fiscal usa desde 04/10, e ela existe por um motivo medido:
 * ***alarme falso repetido é como um alarme morre*** (os 111 do juiz de vendas).
 */
const ORIGENS_QUE_JA_EXPLICAM: readonly string[] = [
  'FICHA_SEM_COMPARACAO', 'FISCAL_DECLARADO', 'LOTE_GRANDEZA', 'PADRAO_RENDIMENTO',
]

/**
 * ⚠️ **GRAVA PELA PORTA ÚNICA e NUNCA derruba o chamador.** Aviso recusado pela lei da língua
 * do balcão é **erro MEU** (texto mal escrito aqui), não motivo pra a contagem do dono falhar
 * nem pra o cron morrer no meio.
 */
async function gravar(r: ResumoDoEstoque, novo: NovoAviso, db: Db) {
  const v = avaliarLinguaDoBalcao(novo)
  if (!v.ok) { r.recusados.push({ motivo: v.motivo, titulo: novo.titulo }); return }
  const { reaberto } = await registrarAviso(novo, db)
  if (reaberto) r.reabertos++
  else r.gravados++
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const brl = (n: number) => `R$ ${Math.abs(n).toFixed(2).replace('.', ',')}`

/**
 * ⭐⭐ O PRODUTOR — chamado pelo **cron das 3h** E logo depois de uma contagem (fail-soft).
 *
 * ⛔ **UMA função pros dois**, nunca duas: o padrão do `garantirCiencia` (05/09). Um gravador
 * "na hora" e outro "na madrugada" seriam duas redações do mesmo alarme, e elas divergiriam na
 * primeira frase ajustada.
 *
 * ⭐ E ele **RECONCILIA**: o que ele deixa de reportar numa rodada é RESOLVIDO. Senão o dono
 * investiga o fermento e o aviso do fermento fica lá pra sempre — *trabalho FEITO tem que sair
 * da fila*.
 */
export async function produzirAvisosDeEstoque(
  companyId: string, agora: Date = new Date(), db: Db = prisma,
): Promise<ResumoDoEstoque> {
  const r: ResumoDoEstoque = { gravados: 0, reabertos: 0, resolvidos: 0, calados: [], recusados: [] }

  const desde = new Date(agora.getTime() - JANELA_DIAS * 86_400_000)
  const linhas = await db.stockContagemNegativo.findMany({
    where: { companyId, criadoEm: { gte: desde } },
    orderBy: [{ criadoEm: 'desc' }],
    select: {
      itemId: true, saldoAntes: true, valorAntes: true, contado: true, motivo: true,
      residuo: true, criadoEm: true, registradoPorNome: true,
    },
  })
  if (!linhas.length) {
    r.resolvidos += await reconciliarOrigem(companyId, ORIGEM, [], db)
    return r
  }

  // ⚠️ um item pode ter sido contado em duas sessões na janela — vale o MAIS RECENTE
  const porItem = new Map<string, (typeof linhas)[number]>()
  for (const l of linhas) if (!porItem.has(l.itemId)) porItem.set(l.itemId, l)

  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: [...porItem.keys()] } },
    select: { id: true, nome: true, unidadeControle: true },
  })
  const nomeDe = new Map(itens.map((i) => [i.id, i]))

  // ⭐ os avisos abertos de OUTRAS origens que já explicam o negativo deste item
  const abertos = await avisosAbertos(companyId)
  const jaExplicado = new Set(
    abertos
      .filter((a) => ORIGENS_QUE_JA_EXPLICAM.includes(a.origem))
      .map((a) => a.alvo),
  )

  const vivos: string[] = []
  for (const [itemId, l] of porItem) {
    const it = nomeDe.get(itemId)
    if (!it) continue
    const alvo = `item:${itemId}`

    /**
     * ⛔ A SUPRESSÃO, item a item: se a causa já tem aviso aberto, este cala. ⚠️ E ele entra em
     * `calados` com o PORQUÊ — supressão silenciosa viraria "o aviso não funciona" na próxima
     * vez que alguém procurasse.
     */
    if (jaExplicado.has(alvo)) {
      r.calados.push({ item: it.nome, porque: 'a causa já tem aviso aberto (uma causa, um alarme)' })
      continue
    }

    const un = it.unidadeControle
    const dinheiro = l.valorAntes < -0.01 ? ` e ${brl(l.valorAntes)} de custo pendurado` : ''
    const quem = l.registradoPorNome ? ` ${l.registradoPorNome}` : ''
    await gravar(r, {
      companyId,
      setor: 'estoque',
      /**
       * ⚠️ **ÂMBAR, não vermelho.** O dado **não está** errado agora — a contagem o ancorou. O
       * que pede olho é a CAUSA. Pintar de vermelho um item que acabou de ser consertado é
       * como o dono aprende a ignorar o vermelho.
       */
      severidade: 'ambar',
      titulo: `Confere por que «${it.nome}» ficou negativo`,
      corpo:
        `«${it.nome}» estava em ${fmt(l.saldoAntes)} ${un}${dinheiro} antes da contagem`
        + `${quem ? ` de${quem}` : ''}. O sistema aceitou ${fmt(l.contado)} ${un} e ajustou o saldo`
        + `${Math.abs(l.residuo) > 0.01 ? `, com ${brl(l.residuo)} escritos fora do custo` : ''}.`
        + ` Quem contou achou que foi: ${rotuloDoMotivo(l.motivo)}.`,
      oQueFazer:
        'Olhe o histórico do item pra achar a causa: dose de ficha errada, perda não lançada '
        + 'ou entrada que faltou. O saldo já está certo — o que falta é não repetir.',
      acaoRotulo: 'ver o histórico do item',
      acaoHref: `/empresas/${companyId}/estoque/itens/${itemId}`,
      origem: ORIGEM,
      alvo,
    }, db)
    vivos.push(alvo)
  }

  r.resolvidos += await reconciliarOrigem(companyId, ORIGEM, vivos, db)
  return r
}
