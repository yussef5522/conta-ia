/**
 * ⭐⭐⭐ "USADO EM N FICHAS" — A BUSCA REVERSA (06/10/2026). O coração do v4 da página do item.
 *
 * **Ordem do dono:** *"Cartão listando TODA ficha (produção e cardápio) que contém o item (…)
 * DESTAQUE AUTOMÁTICO da dose destoante (régua dos irmãos/M2: dose fora de ~5× da mediana das
 * irmãs no mesmo tipo = linha vermelha «dose suspeita — irmãs usam ~X» + [corrigir agora →]
 * indo DIRETO na edição do componente)"*.
 *
 * ⭐ O caminho só existia num sentido: da ficha dava pra ver os componentes; **do item não
 * dava pra ver quem o usa**. É a pergunta que o dono faz quando o custo de um insumo sobe
 * ("que receitas isso estraga?") e quando um saldo fica torto ("quem está baixando isso?").
 *
 * ⛔⛔ **SÓ A VERSÃO ATUAL DE CADA FICHA.** As versões antigas continuam no banco de propósito
 * (ordem antiga aponta pra a versão da época), mas listá-las aqui mostraria a MESMA ficha
 * várias vezes com doses diferentes — e o dono leria isso como "dose suspeita" onde só há
 * histórico.
 *
 * ⚠️ Ficha **inativa** fica fora: ela não baixa mais nada e ofereceria um gesto sobre uma
 * receita aposentada. O histórico do item logo abaixo continua mostrando o que ela consumiu.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { rotuloTipoFicha } from '../tipos-ficha'
import { formatarQtd } from '../quantidade'

type Db = PrismaClient | Prisma.TransactionClient

/** ⛔ o fator que separa "dose diferente" de "dose SUSPEITA" — um número, um lugar */
export const FATOR_SUSPEITO = 5
/**
 * ⚠️⚠️ **3 IRMÃS, NÃO 2** — a lição do M2 (02/10), paga em vermelho: *com duas, a mediana fica
 * NO MEIO do desvio*, e uma dose 40% fora vira `+17%/−17%` — as duas abaixo do teto, e o
 * guard cala justamente no caso que existe pra achar. ⭐ E a razão de fundo é a trava do PAO
 * DE MEL: com duas divergindo, **não há como saber qual das duas está errada**.
 */
export const IRMAS_PARA_COMPARAR = 3

export interface FichaQueUsaOItem {
  fichaId: string
  /** o nome do que a ficha PRODUZ — é por ele que o dono reconhece a receita */
  nome: string
  tipoProduto: string
  tipoLabel: string
  versao: number
  /** a dose DESTE item nesta ficha */
  dose: number
  unidade: string
  /**
   * ⭐ a dose POR EXTENSO, pelo `formatarQtd` da casa — é ele que escreve *"0,059 KG"* como
   * **"59 g"** quando a dose é menor que 1. ⛔ Uma formatação própria aqui faria a mesma dose
   * aparecer diferente na ficha e no item, e é justamente essa leitura que o dono vai comparar.
   */
  doseTexto: string
  href: string
  /** ⭐ a porta que leva DIRETO pra a dose (o editor abre com a linha do componente acesa) */
  hrefCorrigir: string
  /** ⭐⭐ preenchido só quando a dose foge das irmãs — com o número das irmãs à vista */
  suspeita: { mediana: number; irmas: number; frase: string } | null
}

export interface UsadoEmFichas {
  fichas: FichaQueUsaOItem[]
  /** quantas ficaram marcadas como suspeitas (pra o cabeçalho do cartão) */
  suspeitas: number
}

const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * ⭐⭐ A RÉGUA DA DOSE SUSPEITA, PURA — e ela compara **só o que é comparável**.
 *
 * ⛔⛔ AGRUPA POR **(tipo da ficha, UNIDADE da dose)**. Comparar a dose em KG de uma receita com
 * a dose em UN de outra é somar grandezas diferentes — o pecado de 13/09 (*"1.415,84 un" que
 * era porção somada com massa*). Grupo com unidades misturadas não vira alarme: vira dois
 * grupos, e cada um só fala do que entende.
 *
 * ⚠️ E o desvio é nos DOIS sentidos: dose **5× acima** (a que estoura o estoque) e **5× abaixo**
 * (a que faz a receita render o impossível). As duas são erro de digitação de grandeza.
 */
export function marcarDosesSuspeitas(fichas: FichaQueUsaOItem[]): FichaQueUsaOItem[] {
  const grupos = new Map<string, FichaQueUsaOItem[]>()
  for (const f of fichas) {
    const k = `${f.tipoProduto}|${f.unidade}`
    grupos.set(k, [...(grupos.get(k) ?? []), f])
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < IRMAS_PARA_COMPARAR) continue
    const med = mediana(grupo.map((f) => f.dose))
    if (!(med > 0)) continue
    for (const f of grupo) {
      const fora = f.dose > med * FATOR_SUSPEITO || f.dose * FATOR_SUSPEITO < med
      if (!fora) continue
      f.suspeita = {
        mediana: med,
        irmas: grupo.length - 1,
        frase: `dose suspeita — as outras ${grupo.length - 1} receitas usam ~${formatarQtd(med, f.unidade)}`,
      }
    }
  }
  return fichas
}

/**
 * ⭐ A ORDEM É A DO TRABALHO: suspeitas primeiro, depois a dose maior (o peso do item naquela
 * receita).
 *
 * ⚠️ "por uso" poderia ser *quantos lotes cada ficha produziu* — e isso exigiria uma 2ª
 * consulta por ficha, numa tela que já carrega o ledger inteiro do item. A dose é o que
 * decide o impacto de um erro aqui, então é ela que ordena; **está dito, não disfarçado**.
 */
function ordenar(fichas: FichaQueUsaOItem[]): FichaQueUsaOItem[] {
  return [...fichas].sort((a, b) => {
    if (!!a.suspeita !== !!b.suspeita) return a.suspeita ? -1 : 1
    return b.dose - a.dose
  })
}

export async function usadoEmFichas(companyId: string, itemId: string, db: Db): Promise<UsadoEmFichas> {
  const comps = await db.stockFichaComponente.findMany({
    where: { companyId, itemId },
    select: { versaoId: true, qtdPlanejada: true, unidade: true },
  })
  if (!comps.length) return { fichas: [], suspeitas: 0 }

  const versoes = await db.stockFichaVersao.findMany({
    where: { companyId, id: { in: [...new Set(comps.map((c) => c.versaoId))] } },
    select: { id: true, fichaId: true, versao: true },
  })
  const fichasDb = await db.stockFicha.findMany({
    where: { companyId, id: { in: [...new Set(versoes.map((v) => v.fichaId))] }, ativo: true },
    select: { id: true, itemProduzidoId: true, tipoProduto: true, versaoAtual: true },
  })
  const porId = new Map(fichasDb.map((f) => [f.id, f]))
  const nomes = new Map(
    (
      await db.stockItem.findMany({
        where: { companyId, id: { in: fichasDb.map((f) => f.itemProduzidoId) } },
        select: { id: true, nome: true },
      })
    ).map((i) => [i.id, i.nome]),
  )

  const voltar = encodeURIComponent(`/empresas/${companyId}/estoque/itens/${itemId}`)
  const linhas: FichaQueUsaOItem[] = []
  for (const c of comps) {
    const v = versoes.find((x) => x.id === c.versaoId)
    if (!v) continue
    const f = porId.get(v.fichaId)
    // ⛔ só a versão ATUAL (e só ficha ativa — o `porId` já filtrou)
    if (!f || f.versaoAtual !== v.versao) continue
    const href = `/empresas/${companyId}/estoque/fichas/${f.id}?voltar=${voltar}`
    linhas.push({
      fichaId: f.id,
      nome: nomes.get(f.itemProduzidoId) ?? '(sem nome)',
      tipoProduto: f.tipoProduto,
      tipoLabel: rotuloTipoFicha(f.tipoProduto),
      versao: v.versao,
      dose: c.qtdPlanejada,
      unidade: c.unidade,
      doseTexto: formatarQtd(c.qtdPlanejada, c.unidade),
      href,
      /** ⭐ `foco` acende a linha do componente no editor — a porta leva à DOSE, não à ficha */
      hrefCorrigir: `${href}&foco=${itemId}`,
      suspeita: null,
    })
  }

  const marcadas = ordenar(marcarDosesSuspeitas(linhas))
  return { fichas: marcadas, suspeitas: marcadas.filter((f) => f.suspeita).length }
}
