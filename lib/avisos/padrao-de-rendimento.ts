/**
 * ⭐⭐⭐ RENDIMENTO AVISA POR **PADRÃO**, NUNCA POR LOTE ISOLADO (04/10/2026) — PURO.
 *
 * **Decisão do dono, e ela é de DONO, não de aritmética:** *"rendimento avisa por PADRÃO (N
 * lotes seguidos fora, com o nome de quem fez), **NUNCA por lote isolado** — variação de carne
 * é natural."*
 *
 * ⛔⛔ **POR QUE ISSO IMPORTA TANTO:** o juiz P8 já denuncia **42 lotes abaixo de 85%** (medido
 * em 03/10). Virar cada um em aviso faria a central NASCER com 42 linhas de ruído, e o dono
 * aprenderia a ignorar o sininho **na primeira semana** — exatamente o que aconteceu com os 111
 * alarmes falsos de 26/08 e com o e-mail noturno que gritou R$ 21.968,02 por 10 dias sem
 * ninguém agir. Um lote de carne 20% fora é terça-feira; **quatro seguidos é um problema**.
 *
 * ⚠️ **E O P8 CONTINUA DENUNCIANDO LOTE A LOTE NO E-MAIL.** Não é afrouxamento: são perguntas
 * diferentes. O P8 responde *"este lote rendeu mal?"* (auditoria, lote por lote); a central
 * responde *"tem algo acontecendo que eu preciso resolver?"*. Misturar as duas é o que
 * transforma auditoria em ruído.
 */
import { faixaDoSelo, type FaixaDoSelo } from '@/lib/stock/producao/eficiencia-da-ordem'

/**
 * ⭐ TRÊS lotes seguidos — e o número tem razão escrita, não é gosto.
 *
 * Com **2** qualquer par de dias ruins viraria aviso (e a variação natural da carne produz
 * pares com frequência). Com **4+** o padrão demora quase uma semana pra aparecer numa receita
 * que roda 1× por dia, e o dinheiro já vazou. **3 é o menor número que não pode ser chamado de
 * coincidência** — é a mesma escolha do M2 (que exige 3+ componentes pra a mediana ter dono) e
 * do "2 rodadas sem novidade" do loop-until-dry.
 */
export const LOTES_SEGUIDOS_PRA_PADRAO = 3

export interface LoteMedido {
  /** o identificador da ordem — entra no texto do aviso pro dono achar o lote */
  ordemId: string
  /** ISO do encerramento — a ORDEM dos lotes sai daqui, nunca da ordem do array */
  encerradoEm: string
  /** a eficiência CONGELADA que o P8 lê (`stock_producao_desvio.pctTeorico`) */
  pct: number | null
  /** quem concluiu — o dono pediu o NOME no aviso */
  quem: string | null
}

export interface PadraoDeRendimento {
  /** quantos lotes seguidos, do mais recente pra trás, estão fora da faixa */
  seguidos: number
  /** os lotes do padrão, do mais ANTIGO pro mais recente (é como a frase lê melhor) */
  lotes: LoteMedido[]
  /** os nomes envolvidos, sem repetir, na ordem em que apareceram */
  quem: string[]
  /** 'BAIXO' quando todos renderam MENOS; 'ALTO' quando todos renderam mais; 'MISTO' */
  sentido: 'BAIXO' | 'ALTO' | 'MISTO'
}

function sentidoDe(pct: number): 'BAIXO' | 'ALTO' {
  return pct < 100 ? 'BAIXO' : 'ALTO'
}

/**
 * ⭐⭐ Acha o padrão: a SEQUÊNCIA MAIS RECENTE de lotes fora da faixa.
 *
 * ⛔⛔ **A sequência é contada do MAIS RECENTE PRA TRÁS, e isso é o coração da regra.** Contar
 * "quantos lotes estão fora no período" acusaria uma receita que teve 3 lotes ruins em agosto e
 * está ótima desde então — o dono iria caçar um problema que ele já resolveu. O que vale é
 * *"está acontecendo AGORA"*: se o último lote voltou pra faixa, o padrão **quebrou**, e o aviso
 * se resolve sozinho na próxima rodada do juiz.
 *
 * ⚠️ **Lote SEM PEDIDO não conta nem quebra a sequência** — ele não é medível (as 471 ordens
 * antigas não têm meta). Deixá-lo QUEBRAR a sequência faria um lote antigo sem pedido esconder
 * um padrão real; deixá-lo CONTAR seria inventar uma medição que ninguém fez.
 */
export function acharPadrao(
  lotes: LoteMedido[],
  seguidosMinimo: number = LOTES_SEGUIDOS_PRA_PADRAO,
): PadraoDeRendimento | null {
  /** ⚠️ ordena pelo relógio, nunca confia na ordem que o chamador mandou */
  const ordenados = [...lotes].sort((a, b) => a.encerradoEm.localeCompare(b.encerradoEm))

  const sequencia: LoteMedido[] = []
  for (let i = ordenados.length - 1; i >= 0; i--) {
    const l = ordenados[i]
    const faixa: FaixaDoSelo = faixaDoSelo(l.pct)
    if (faixa === 'SEM_PEDIDO') continue // não mede, não quebra
    if (faixa === 'DENTRO') break        // ⭐ voltou pra faixa: o padrão acabou
    sequencia.push(l)
  }

  if (sequencia.length < seguidosMinimo) return null

  const doMaisAntigo = sequencia.reverse()
  const sentidos = new Set(doMaisAntigo.map((l) => sentidoDe(l.pct as number)))
  const quem: string[] = []
  for (const l of doMaisAntigo) {
    const n = l.quem?.trim()
    if (n && !quem.includes(n)) quem.push(n)
  }

  return {
    seguidos: doMaisAntigo.length,
    lotes: doMaisAntigo,
    quem,
    sentido: sentidos.size === 1 ? [...sentidos][0] : 'MISTO',
  }
}

/**
 * ⭐ A FRASE DO AVISO, na língua do balcão — com o NOME de quem fez, como o dono pediu.
 *
 * ⚠️ O texto diz os percentuais dos lotes porque *"fora da faixa"* sem número não dá pra
 * conferir: o dono precisa saber se foi 80% ou 300% pra decidir se o problema é a ficha, a
 * balança ou a mão.
 */
export function fraseDoPadrao(receita: string, p: PadraoDeRendimento): { titulo: string; corpo: string; oQueFazer: string } {
  const pcts = p.lotes.map((l) => `${Math.round(l.pct as number)}%`).join(' · ')
  const nomes =
    p.quem.length === 0
      ? 'sem nome registrado'
      : p.quem.length === 1
        ? p.quem[0]
        : `${p.quem.slice(0, -1).join(', ')} e ${p.quem[p.quem.length - 1]}`

  const lado =
    p.sentido === 'BAIXO'
      ? 'saindo MENOS do que a ficha promete'
      : p.sentido === 'ALTO'
        ? 'saindo MAIS do que a ficha promete'
        : 'longe do que a ficha promete, pra cima e pra baixo'

  return {
    titulo: `Revise a receita de ${receita} — ${p.seguidos} lotes seguidos fora`,
    corpo:
      `Os últimos ${p.seguidos} lotes de ${receita} saíram ${lado} (${pcts}), feitos por ${nomes}. ` +
      `Um lote fora é normal; ${p.seguidos} seguidos é padrão.`,
    oQueFazer:
      p.sentido === 'BAIXO'
        ? `Confira a ficha e a porção com ${nomes}: ou a receita pede mais do que precisa, ou está saindo porção maior que a combinada.`
        : `Confira a ficha de ${receita}: se está saindo mais do que ela promete, a dose da ficha está alta e o custo por unidade está errado.`,
  }
}
