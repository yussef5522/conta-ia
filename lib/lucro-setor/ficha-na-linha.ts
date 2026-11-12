/**
 * ⭐ FICHA NA LINHA (S13/S22) — o CORPO que a tela do Lucro por Setor manda pra PORTA ÚNICA do
 * editor de fichas (POST /estoque/fichas · PATCH /estoque/fichas/[id]). Puro: roda no navegador.
 *
 * ⛔ NÃO É UM SEGUNDO EDITOR: não grava nada, não valida regra de negócio própria. A gravação, as
 *    validações (rendimento, ciclo, homônima) e o vínculo nome do PDV → ficha (na MESMA transação)
 *    são os do servidor, os mesmos de hoje. Aqui só se monta o corpo — e o prefill (nome/preço)
 *    sai da MESMA função pura do editor (`valoresIniciaisDaFicha`).
 * ⛔ S22 · ficha vazia não se grava (a porta exige ≥ 1 componente): enquanto vazia, ela continua
 *    contando como SEM ficha na tela — custo zero não é custo.
 */
import { valoresIniciaisDaFicha } from '@/lib/stock/cardapio/valores-iniciais'
import { aceitaFracao, validarQtd, valorQtd, textoQtd } from '@/lib/stock/quantidade'

export interface CompNaLinha {
  itemId: string
  nome: string
  unidade: string
  /** o texto do campo (fonte da verdade, como no editor) */
  qtdTexto: string
  custoMedio: number | null
}

/** S13 · o passo do −/+ (o da lei): UN anda de 1 em 1; KG/LT de 0,01 em 0,01 — nunca chega a 0 */
export function passoDaDose(unidade: string): number {
  return aceitaFracao(unidade) ? 0.01 : 1
}
export function moverDose(c: CompNaLinha, sinal: 1 | -1): CompNaLinha {
  const p = passoDaDose(c.unidade)
  const atual = valorQtd(c.qtdTexto) ?? 0
  const novo = Math.max(p, Math.round((atual + sinal * p) * 1000) / 1000)
  return { ...c, qtdTexto: textoQtd(novo) }
}

/**
 * custo da ficha AO VIVO (Σ qtd × custo médio).
 * ⭐ E3 (12/11): ingrediente SEM PREÇO não zera a ficha — soma o que tem preço e diz quantos
 * faltam (`faltam`), o rodapé vira "pelo menos R$ X · N ingrediente sem preço".
 * `custo: null` = ficha vazia ou NADA com preço (não há o que somar — nunca "R$ 0,00").
 */
export function custoAoVivo(comps: readonly CompNaLinha[]): { custo: number | null; faltam: number } {
  let t = 0
  let comPreco = 0
  let faltam = 0
  for (const c of comps) {
    const q = valorQtd(c.qtdTexto)
    if (c.custoMedio == null) { faltam++; continue }
    if (q == null) continue
    t += q * c.custoMedio
    comPreco++
  }
  return { custo: comPreco ? Math.round(t * 100) / 100 : null, faltam }
}

/** o rodapé da ficha aberta (E3): completo · "pelo menos … · N sem preço" · "a definir" · "sem ficha" */
export function rodapeDaFicha(comps: readonly CompNaLinha[], brl: (v: number) => string): string {
  if (!comps.length) return 'sem ficha'
  const { custo, faltam } = custoAoVivo(comps)
  if (custo == null) return 'a definir'
  return faltam ? `pelo menos ${brl(custo)} · ${faltam} ingrediente${faltam > 1 ? 's' : ''} sem preço` : brl(custo)
}

/** a primeira recusa de quantidade (a MESMA mensagem do editor) — `null` = pode gravar */
export function recusa(comps: readonly CompNaLinha[]): string | null {
  if (!comps.length) return 'Adicione ao menos um ingrediente.'
  for (const c of comps) {
    const e = validarQtd(c.qtdTexto, c.unidade, c.nome)
    if (e) return e
  }
  return null
}

const componentes = (comps: readonly CompNaLinha[]) => comps.map((c, i) => ({ itemId: c.itemId, qtdPlanejada: valorQtd(c.qtdTexto) ?? 0, unidade: c.unidade, posicao: i }))

/** PATCH /estoque/fichas/[id] — só os componentes (a porta versiona a ficha) */
export function corpoDaEdicao(comps: readonly CompNaLinha[]) {
  return { componentes: componentes(comps) }
}

/**
 * POST /estoque/fichas — a ficha NASCE na linha, já ligada ao(s) nome(s) do PDV:
 *   produto → PRODUTO_FINAL com `mapearNomeSuitable` (todos os apelidos);
 *   sabor   → SABOR com `mapearComplemento`.
 */
export function corpoDaCriacao(alvo: { tipo: 'PRODUTO' | 'SABOR'; nome: string; nomesPdv: readonly string[]; preco: number | null }, comps: readonly CompNaLinha[]) {
  const modo: 'PRODUTO_FINAL' | 'SABOR' = alvo.tipo === 'PRODUTO' ? 'PRODUTO_FINAL' : 'SABOR'
  const ini = valoresIniciaisDaFicha(modo, { nome: alvo.nome, nomesSuitable: [...alvo.nomesPdv], precoPraticado: alvo.tipo === 'PRODUTO' ? alvo.preco : null, precoCardapio: null, fichaId: null })
  const preco = valorQtd(ini.preco)
  return {
    nomeProduzido: ini.nome || alvo.nome,
    unidadeProduzido: 'UN' as const,
    tipoProduto: modo,
    valorVenda: modo === 'PRODUTO_FINAL' && preco != null && preco > 0 ? preco : null,
    loteBase: valorQtd(ini.loteBase) ?? 1,
    unidadeLoteBase: 'UN' as const,
    componentes: componentes(comps),
    mapearNomeSuitable: alvo.tipo === 'PRODUTO' ? [...alvo.nomesPdv] : null,
    mapearComplemento: alvo.tipo === 'SABOR' ? [...alvo.nomesPdv] : null,
  }
}
