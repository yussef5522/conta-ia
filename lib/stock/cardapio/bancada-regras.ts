// ⭐⭐ AS REGRAS PURAS DA BANCADA DE VÍNCULOS — lei docs/bancada-referencia.html (v1 APROVADA, R32–R35).
// Sem banco: a TELA importa daqui (placar, ordem, filtros, desconto) e a leitura (`bancada.ts`) também —
// uma régua só pros dois lados. Os 7 pinos da lei rodam contra este arquivo (bancada-pinos.test.ts).
import { reguaDoNome } from '@/lib/nomes/regua-do-nome'
import { ehPizza } from '../vendas/razao-sabor-pizza'

export const DIAS_DA_BANCADA = 30

export type TipoNaBancada = 'PRODUTO' | 'COMPLEMENTO'
export type EstadoNaBancada = 'PENDENTE' | 'IGNORADO' | 'RESOLVIDO'

/** ⭐ a ficha candidata — o dono clica; o sistema nunca liga sozinho */
export interface SugestaoDaBancada { fichaId: string; nomeFicha: string; motivo: string }
/** ⭐ casca de pizza cujos SABORES têm ficha (ex.: "PIZZA … BLACK FRIDAY") — o dono decide ignorar */
export interface DicaDeCasca { familia: string; sabores: string[] }

export interface LinhaDaBancada {
  /** `P:<nome>` | `C:<nome>` — o mesmo nome pode existir nos dois relatórios do PDV */
  chave: string
  tipo: TipoNaBancada
  nome: string
  /** unidades (produto) ou ocorrências (complemento) nos 30 dias */
  qt: number
  /** R$ vendidos nos 30 dias (complemento incluso no preço = 0) */
  rs: number
  estado: EstadoNaBancada
  fichaId: string | null
  nomeFicha: string | null
  sugestao: SugestaoDaBancada | null
  casca: DicaDeCasca | null
}

export interface RazaoDoCusto {
  /** custo das BAIXA_VENDA ativas (sem as estornadas) nos 30 dias */
  custoBaixado: number
  /** faturamento dos nomes que BAIXAM (resolvidos) nos 30 dias */
  faturamentoQueBaixa: number
  /** null quando não há faturamento que baixa — "a definir", nunca 0 */
  razao: number | null
}

export interface Placar {
  fat30: number
  custoDia: number | null
  produtos: number
  complementos: number
  total: number
}

export interface Bancada {
  linhas: LinhaDaBancada[]
  razao: RazaoDoCusto
  periodo: { de: string; ate: string; dias: number }
}

/** R33 — o custo/dia ESTIMADO: faturamento sem baixa × razão custo/faturamento ÷ 30 */
export function custoDia(fat30: number, razao: number | null): number | null {
  return razao == null ? null : (fat30 * razao) / DIAS_DA_BANCADA
}

/** formato do placar: `R$ 20.800` (pt-BR, sem centavos) */
export const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')

/** R34 — maior R$ primeiro; R$ 0 (incluso) ordena pelas ocorrências; empate final pelo nome */
export function ordenarFila<T extends { rs: number; qt: number; nome: string }>(fila: readonly T[]): T[] {
  return [...fila].sort((a, b) => (b.rs - a.rs) || (b.qt - a.qt) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** R33 — o placar, SEMPRE derivado das linhas pendentes */
export function placarDe(linhas: readonly LinhaDaBancada[], razao: number | null): Placar {
  const pend = linhas.filter((l) => l.estado === 'PENDENTE')
  const fat30 = Math.round(pend.reduce((s, l) => s + l.rs, 0) * 100) / 100
  const produtos = pend.filter((l) => l.tipo === 'PRODUTO').length
  const complementos = pend.length - produtos
  return { fat30, custoDia: custoDia(fat30, razao), produtos, complementos, total: pend.length }
}

export type FiltroDaBancada = 'TUDO' | 'PRODUTOS' | 'COMPLEMENTOS' | 'IGNORADOS' | 'RESOLVIDOS'
export const FILTROS_DA_BANCADA: readonly { chave: FiltroDaBancada; rotulo: string }[] = [
  { chave: 'TUDO', rotulo: 'Tudo' },
  { chave: 'PRODUTOS', rotulo: 'Produtos' },
  { chave: 'COMPLEMENTOS', rotulo: 'Complementos' },
  { chave: 'IGNORADOS', rotulo: 'Ignorados' },
  { chave: 'RESOLVIDOS', rotulo: 'Resolvidos' },
]

const passa = (l: LinhaDaBancada, f: FiltroDaBancada) =>
  f === 'IGNORADOS' ? l.estado === 'IGNORADO'
    : f === 'RESOLVIDOS' ? l.estado === 'RESOLVIDO'
      : l.estado === 'PENDENTE' && (f === 'TUDO' || (f === 'PRODUTOS' ? l.tipo === 'PRODUTO' : l.tipo === 'COMPLEMENTO'))

/** os contadores dos filtros (Tudo/Produtos/Complementos contam só a FILA; resolvido some dela, não da história) */
export function contarFiltros(linhas: readonly LinhaDaBancada[]): Record<FiltroDaBancada, number> {
  const out = { TUDO: 0, PRODUTOS: 0, COMPLEMENTOS: 0, IGNORADOS: 0, RESOLVIDOS: 0 } as Record<FiltroDaBancada, number>
  for (const l of linhas) for (const { chave } of FILTROS_DA_BANCADA) if (passa(l, chave)) out[chave]++
  return out
}

/** filtro + busca + R34 */
export function filaVisivel(linhas: readonly LinhaDaBancada[], filtro: FiltroDaBancada, busca: string): LinhaDaBancada[] {
  const q = reguaDoNome(busca)
  return ordenarFila(linhas.filter((l) => passa(l, filtro) && (!q || reguaDoNome(l.nome).includes(q))))
}

/**
 * ⭐ A LIGAÇÃO NA TELA: devolve as linhas com a decisão aplicada — e, como o placar é derivado delas,
 * ele desconta na hora. O servidor confirma no recarregar (a verdade é o banco).
 */
export function aplicarDecisao(
  linhas: readonly LinhaDaBancada[], chave: string,
  d: { estado: EstadoNaBancada; fichaId?: string | null; nomeFicha?: string | null },
): LinhaDaBancada[] {
  return linhas.map((l) => (l.chave !== chave ? l : {
    ...l, estado: d.estado,
    fichaId: d.estado === 'RESOLVIDO' ? d.fichaId ?? null : null,
    nomeFicha: d.estado === 'RESOLVIDO' ? d.nomeFicha ?? null : null,
  }))
}

// ─────────────────────────────── a dica de CASCA ───────────────────────────────

/**
 * ⚠️ As palavras que NÃO identificam a família de uma casca de pizza (tamanho, conectivo e os sabores
 * clássicos que a própria casca lista: "PIZZA GRANDE CALABRESA OU MUSSARELA OU FRANGO BLACK FRIDAY" →
 * família "BLACK FRIDAY"). Lista FECHADA, com o motivo: é ela que separa a família do resto do nome.
 */
const FORA_DA_FAMILIA = new Set(['PIZZA', 'GRANDE', 'FAMILIA', 'MEDIA', 'PEQUENA', 'BROTO', 'OU', 'E', 'DE', 'COM', 'SABOR', 'SABORES', 'CALABRESA', 'MUSSARELA', 'FRANGO'])

/** a família de uma casca (palavras que sobram), ou [] */
export function familiaDaCasca(nome: string): string[] {
  return reguaDoNome(nome).split(' ').filter((t) => t && !FORA_DA_FAMILIA.has(t) && !/^\d+(CM)?$/.test(t))
}

/** ⭐ é casca? pizza pela régua oficial cuja família aparece em complementos COM ficha — SÓ DICA */
export function dicaDeCasca(nomeProduto: string, complementosComFicha: readonly string[]): DicaDeCasca | null {
  if (!ehPizza(nomeProduto)) return null
  const fam = familiaDaCasca(nomeProduto)
  if (!fam.length) return null
  const sabores = complementosComFicha.filter((c) => { const ts = reguaDoNome(c).split(' '); return fam.every((t) => ts.includes(t)) })
  return sabores.length ? { familia: fam.join(' '), sabores: sabores.slice(0, 3) } : null
}

