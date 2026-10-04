/**
 * ⭐⭐ O AVISO VERDE SEMANAL (04/10/2026) — *"tudo certo"*, 1 por semana, domingo.
 *
 * **Pedido do dono:** *"aviso verde semanal 'tudo certo — estoque fecha X/X, bancos ✓' (1 por
 * semana, domingo)."*
 *
 * ⭐ **Por que um aviso VERDE existe numa central de problemas:** central que só fala quando
 * tem problema ensina o dono a abrir com medo e, pior, não distingue *"está tudo bem"* de
 * *"ninguém olhou"*. O verde semanal é o sistema dizendo **"eu conferi e fecha"** — o oposto do
 * silêncio, que esta casa já tratou como doença (*"silêncio lido como saúde"*, o juiz de 05/09).
 *
 * ⛔⛔ **E ELE NÃO PODE MENTIR: só sai quando NÃO há vermelho nem coral em aberto.** Um verde
 * "tudo certo" ao lado de um aviso vermelho destrói a confiança nos dois — e aí nenhum dos dois
 * é lido.
 */
import type { NovoAviso, Severidade } from './tipos'

/**
 * ⭐ A semana ISO vira o ALVO do dedupe — e isso faz *"1 por semana"* ser **impossível de
 * violar**, não uma checagem: `origem='SEMANA_VERDE' + alvo='2026-W40'` é UNIQUE no banco, então
 * rodar o cron 7 vezes no domingo dá **um** aviso.
 *
 * ⚠️ A conta é em UTC de propósito: o alvo é uma CHAVE, não um texto que o dono lê. Semana
 * calculada no fuso do servidor mudaria de valor se o servidor mudasse de fuso, e aí a mesma
 * semana nasceria duas vezes.
 */
export function semanaIso(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // quinta-feira da mesma semana define o ano ISO
  const dia = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dia)
  const ano = t.getUTCFullYear()
  const primeiro = new Date(Date.UTC(ano, 0, 1))
  const semana = Math.ceil(((t.getTime() - primeiro.getTime()) / 86400000 + 1) / 7)
  return `${ano}-W${String(semana).padStart(2, '0')}`
}

/** ⭐ domingo no fuso do BRASIL — o dia que o dono enxerga, não o do UTC (a régua de 13/09) */
export function ehDomingoNoBrasil(agora: Date): boolean {
  const brasil = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
  return brasil.getUTCDay() === 0
}

export interface FotoDaSemana {
  /** quantos itens das listas vigiadas fecharam a conta de padeiro */
  contasQueFecham: number
  contasConferidas: number
  /** contas bancárias que batem (ou têm a diferença explicada) */
  bancosOk: number
  bancosTotal: number
  /** as severidades em aberto AGORA — o verde não sai se houver vermelho/coral */
  severidadesAbertas: Severidade[]
}

/**
 * ⛔ Devolve `null` quando NÃO é pra falar. Três motivos, todos deliberados:
 * (a) não é domingo; (b) há vermelho ou coral em aberto (o verde mentiria ao lado deles);
 * (c) não há nada medido (dizer "tudo certo" sem ter conferido nada é o pior tipo de verde —
 * é o selo de graça que o invariante circular de 28/08 deu).
 */
export function montarSemanaVerde(
  companyId: string,
  foto: FotoDaSemana,
  agora: Date,
): NovoAviso | null {
  if (!ehDomingoNoBrasil(agora)) return null
  if (foto.severidadesAbertas.some((s) => s === 'vermelho' || s === 'coral')) return null
  if (foto.contasConferidas === 0 && foto.bancosTotal === 0) return null

  const estoque = `estoque fecha ${foto.contasQueFecham}/${foto.contasConferidas}`
  const bancos = foto.bancosTotal > 0 ? `bancos ${foto.bancosOk}/${foto.bancosTotal} ✓` : 'bancos sem extrato novo'

  return {
    companyId,
    setor: 'sistema',
    severidade: 'verde',
    titulo: 'Está tudo certo — conferi a semana e fecha',
    corpo: `${estoque} · ${bancos}. Nenhum problema em aberto nesta semana.`,
    oQueFazer: 'Olhe o resumo e siga — nada pede ação sua agora.',
    acaoRotulo: null,
    acaoHref: null,
    origem: 'SEMANA_VERDE',
    alvo: semanaIso(agora),
  }
}
