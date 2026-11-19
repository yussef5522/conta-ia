/**
 * ⭐⭐ OS 7 PINOS DA LEI DA BANCADA (docs/bancada-referencia.html, último <script>) — portados pra lib.
 *
 * ⛔ A amostra (FILA, TOTAIS) é LIDA DO ARQUIVO DA LEI, não copiada: se a lei mudar, o pino muda junto, e as
 * funções que rodam aqui são as MESMAS que a tela usa (`lib/stock/cardapio/bancada-regras.ts`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ordenarFila, custoDia, brl0, placarDe, contarFiltros, filaVisivel, aplicarDecisao, dicaDeCasca,
  type LinhaDaBancada,
} from '../bancada-regras'

const LEI = readFileSync(join(process.cwd(), 'docs/bancada-referencia.html'), 'utf8')
const literal = (nome: string) => {
  const m = LEI.match(new RegExp(`const ${nome} = (\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\});`))
  expect(m, `a lei não tem ${nome}`).toBeTruthy()
  return new Function(`return ${m![1]}`)() as unknown
}
type Amostra = { nm: string; tipo: 'p' | 'c'; qt: number; rs: number; sug?: string }
const FILA = (literal('FILA') as Amostra[]).map((x) => ({ ...x, nome: x.nm }))
const TOTAIS = literal('TOTAIS') as { fat30: number; razao: number; prod: number; comp: number; ign: number; ok: number }

const linha = (nome: string, tipo: 'PRODUTO' | 'COMPLEMENTO', rs: number, qt = 1, estado: LinhaDaBancada['estado'] = 'PENDENTE'): LinhaDaBancada =>
  ({ chave: `${tipo[0]}:${nome}`, tipo, nome, qt, rs, estado, fichaId: null, nomeFicha: null, sugestao: null, casca: null })

describe('os 7 pinos da lei, contra a lib', () => {
  it('a lei é a certa (título exato) e tem 7 pinos', () => {
    expect(LEI).toContain('<title>BANCADA DE VÍNCULOS (estoque) — referência v1 APROVADA</title>')
    const pinos = LEI.slice(LEI.lastIndexOf('<script>')).match(/^\s+\['[^']+',/gm) ?? []
    expect(pinos).toHaveLength(7)
  })
  it('1 · maior R$ vem primeiro', () => {
    expect(ordenarFila(FILA)[0].nm).toBe('MILKSHAKE OVONINHO')
  })
  it('2 · R$ 0 incluso vai pro fim', () => {
    expect(ordenarFila(FILA).at(-1)!.nm).toBe('CHOCOLATE PRETO')
  })
  it('3 · empate de R$ decide por qtd', () => {
    expect(ordenarFila([{ nome: 'a', qt: 5, rs: 0 }, { nome: 'b', qt: 9, rs: 0 }])[0].nome).toBe('b')
  })
  it('4 · custo/dia ≈ 218', () => {
    expect(Math.round(custoDia(TOTAIS.fat30, TOTAIS.razao)!)).toBe(218)
    expect(custoDia(TOTAIS.fat30, null), 'sem razão é "a definir", nunca 0').toBeNull()
  })
  it('5 · fila soma 205 — e a fila é UMA só (produtos + complementos) (R32)', () => {
    expect(TOTAIS.prod + TOTAIS.comp).toBe(205)
    const ls = [
      ...Array.from({ length: TOTAIS.prod }, (_, i) => linha(`p${i}`, 'PRODUTO', 10)),
      ...Array.from({ length: TOTAIS.comp }, (_, i) => linha(`c${i}`, 'COMPLEMENTO', 0, 3)),
      ...Array.from({ length: TOTAIS.ign }, (_, i) => linha(`i${i}`, 'COMPLEMENTO', 0, 1, 'IGNORADO')),
      ...Array.from({ length: TOTAIS.ok }, (_, i) => linha(`o${i}`, 'COMPLEMENTO', 5, 1, 'RESOLVIDO')),
    ]
    expect(placarDe(ls, TOTAIS.razao)).toMatchObject({ total: 205, produtos: 102, complementos: 103 })
    expect(contarFiltros(ls)).toEqual({ TUDO: 205, PRODUTOS: 102, COMPLEMENTOS: 103, IGNORADOS: 16, RESOLVIDOS: 97 })
    const tipos = new Set(filaVisivel(ls, 'TUDO', '').map((l) => l.tipo))
    expect([...tipos].sort()).toEqual(['COMPLEMENTO', 'PRODUTO'])
  })
  it('6 · sugestão só quando existe — a amostra tem 2; a dica de casca só com sabor de ficha', () => {
    expect(FILA.filter((x) => x.sug).length).toBe(2)
    expect(dicaDeCasca('PIZZA GRANDE CALABRESA OU MUSSARELA OU FRANGO BLACK FRIDAY', ['CALABRESA BLACK FRIDAY', 'FRANGO BLACK FRIDAY']))
      .toEqual({ familia: 'BLACK FRIDAY', sabores: ['CALABRESA BLACK FRIDAY', 'FRANGO BLACK FRIDAY'] })
    expect(dicaDeCasca('PIZZA GRANDE CALABRESA OU MUSSARELA OU FRANGO BLACK FRIDAY', ['PORTUGUESA'])).toBeNull()
    expect(dicaDeCasca('MILKSHAKE OVONINHO', ['OVONINHO'])).toBeNull()
  })
  it('7 · formato pt-BR do placar', () => {
    expect(brl0(20800)).toBe('R$ 20.800')
  })
})

describe('R33 — cada ligação DESCONTA o placar na hora', () => {
  it('ligar uma linha tira o R$ dela do placar e ela sai da fila (vai pra Resolvidos)', () => {
    const ls = [linha('MILKSHAKE OVONINHO', 'PRODUTO', 1673, 73), linha('PORTUGUESA', 'COMPLEMENTO', 787, 150)]
    const antes = placarDe(ls, 0.314)
    const depois = placarDe(aplicarDecisao(ls, 'P:MILKSHAKE OVONINHO', { estado: 'RESOLVIDO', fichaId: 'f', nomeFicha: 'MILKSHAKE' }), 0.314)
    expect(antes.fat30).toBe(2460)
    expect(depois.fat30).toBe(787)
    expect(depois).toMatchObject({ total: 1, produtos: 0, complementos: 1 })
    const ign = placarDe(aplicarDecisao(ls, 'C:PORTUGUESA', { estado: 'IGNORADO' }), 0.314)
    expect(ign.fat30).toBe(1673)
  })
})
