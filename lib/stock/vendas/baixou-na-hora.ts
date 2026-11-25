/**
 * ⭐⭐⭐ O EVENTO MANDA — "ESTA LINHA BAIXOU ESTOQUE QUANDO O DIA FECHOU?" (25/11/2026). PORTA ÚNICA.
 *
 * ⛔ O CASO: o PROMOO 3 PIZZAS GRANDES vendeu 31 un em 24/11 SEM ficha (nada baixou); a ficha nasceu
 * às 05:00 do dia seguinte. A coluna "destino no estoque" do detalhe passou a dizer "baixou ficha ✓"
 * sobre esse dia — porque ela perguntava ao MAPA DE HOJE, não ao que aconteceu no fechamento.
 *
 * ⭐ A REGRA: quem responde é o REGISTRO do fechamento — `stock_venda_linha.mapeadoNoImport`, gravado
 * na MESMA transação que as BAIXA_VENDA do dia (`gravarLinhasDoImport`). Desde 25/11 ele quer dizer
 * "esta linha BAIXOU de fato" (estava no plano e a explosão tinha o que tirar).
 *
 * ⚠️ O LEGADO: antes de 25/11 o campo era a grafia EXATA no mapa — uma grafia IRMÃ (canônica) baixava
 * pela ficha da irmã e a linha ficava `false`. Por isso o `false` sozinho não condena: vale também a
 * PROVA DA DATA — a linha do mapa que decide hoje já existia quando a linha do dia foi gravada (o
 * fechamento viu o destino). ⛔ O PROMOO de 24/11: linha gravada 04:17, mapa criado 05:00 → não baixou.
 * (Um mapa que troca de ficha mantém a data — mas aí ALGUMA ficha baixou, que é o que a pergunta quer.)
 *
 * Os leitores (detalhe do dia, lista de dias da central, guarda diária, pergunta de acerto) chamam
 * AQUI. Uma régua só pra "baixou na hora?" — cópia é a doença dos 7 detectores de par.
 */
import type { ResolucaoDeGrafia } from './grafia-canonica'
import { mapaQueDecide } from './grafia-canonica'

export interface LinhaDoFechamento {
  mapeadoNoImport: boolean
  criadoEm: Date
}

export interface MapaComData {
  nomeSuitable: string
  alvoTipo: string
  fichaId: string | null
  itemId: string | null
  criadoEm: Date
}

export function baixouNaHora(l: LinhaDoFechamento, r: ResolucaoDeGrafia<MapaComData>): boolean {
  if (l.mapeadoNoImport) return true
  const m = mapaQueDecide(r)
  return !!m && m.criadoEm.getTime() <= l.criadoEm.getTime()
}

/** ⭐ "ficha tardia": tem destino HOJE e não baixou no fechamento (nem é IGNORAR) */
export function ficouPraTras(l: LinhaDoFechamento, r: ResolucaoDeGrafia<MapaComData>): boolean {
  const m = mapaQueDecide(r)
  if (!m || m.alvoTipo === 'IGNORAR') return false
  return !baixouNaHora(l, r)
}

/** ⭐ a `origem` do movimento de acerto — o extrato do item lê ela pra dizer "ficha criada depois" */
export const ORIGEM_ACERTO_FICHA_TARDIA = 'ACERTO_FICHA_TARDIA'

/** a chave do acerto: um por import + nome */
export const chaveDoAcerto = (importId: string, nomeSuitable: string) => `${importId}|${nomeSuitable}`

/** ⭐ a frase da pergunta, na língua do balcão — a tela (cliente) e o servidor usam a MESMA. Módulo puro. */
export function fraseDaPendencia(p: { nomeSuitable: string; quantidade: number; dia: string }): string {
  return `${p.nomeSuitable} vendeu ${p.quantidade.toLocaleString('pt-BR')} un sem ficha em ${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)} — baixar agora o que ficou pra trás?`
}
