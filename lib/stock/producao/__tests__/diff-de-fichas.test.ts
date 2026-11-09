/**
 * ⭐⭐ 09/11/2026 — O MIOLO DAS FICHAS GÊMEAS: o diff, EXECUTADO.
 *
 * ⛔ O invariante é medido contra a função de custo REAL (`calcularCustoTeorico`, a mesma que
 * dá o "custo do lote" do comparador) — nunca contra uma conta refeita aqui.
 */
import { describe, it, expect } from 'vitest'
import { diffDeFichas, resumoDoDiff, type ComponenteDaFicha, type FichaParaDiff } from '../diff-de-fichas'
import { calcularCustoTeorico } from '@/lib/stock/producao/custo-teorico'

const comp = (itemId: string, nome: string, qtd: number, unidade: string, custoMedio: number | null): ComponenteDaFicha =>
  ({ itemId, nome, qtdPlanejada: qtd, unidade, custoMedio })
const ficha = (fichaId: string, nome: string, componentes: ComponenteDaFicha[]): FichaParaDiff =>
  ({ fichaId, nome, componentes, custoLote: calcularCustoTeorico(componentes, null).custoLote })

// campos preenchidos: dose divergente, ingrediente exclusivo, iguais e custos "quebrados"
const A = ficha('fA', 'XIS COMPLETO', [
  comp('pao', 'PAO DE XIS', 1, 'UN', 1.237),
  comp('bacon', 'BACON', 0.05, 'KG', 41.333),
  comp('ovo', 'OVO', 1, 'UN', 0.587),
  comp('queijo', 'QUEIJO', 0.04, 'KG', 39.9),
])
const B = ficha('fB', 'XIS - COMPLETO', [
  comp('pao', 'PAO DE XIS', 1, 'UN', 1.237),
  comp('bacon', 'BACON', 0.03, 'KG', 41.333),
  comp('queijo', 'QUEIJO', 0.04, 'KG', 39.9),
  comp('milho', 'MILHO', 0.02, 'KG', 12.5),
])

describe('diffDeFichas — alinha por item', () => {
  const d = diffDeFichas(A, B)
  const l = (id: string) => d.linhas.find((x) => x.itemId === id)!

  it('⭐ dose divergente mostra as DUAS doses', () => {
    expect(l('bacon')).toMatchObject({ tipo: 'DOSE', a: { qtd: 0.05, unidade: 'KG' }, b: { qtd: 0.03, unidade: 'KG' } })
    expect(l('bacon').diferenca).toBeCloseTo(0.83, 2)
  })
  it('⭐ ingrediente exclusivo de cada lado', () => {
    expect(l('ovo')).toMatchObject({ tipo: 'SO_A', b: null, diferenca: 0.59 })
    expect(l('milho')).toMatchObject({ tipo: 'SO_B', a: null, diferenca: -0.25 })
  })
  it('igual fica quieto (diferença 0) e vai pro fim', () => {
    expect(l('pao')).toMatchObject({ tipo: 'IGUAL', diferenca: 0 })
    expect(d.linhas.slice(-2).map((x) => x.tipo)).toEqual(['IGUAL', 'IGUAL'])
  })
  it('⭐ o resumo é montado das linhas', () => {
    const r = resumoDoDiff(d).replace(/\u00a0/g, ' ')
    expect(r).toContain('BACON (0,05 KG × 0,03 KG) +R$ 0,83')
    expect(r).toContain('OVO só na XIS COMPLETO +R$ 0,59')
    expect(r).toContain('MILHO só na XIS - COMPLETO −R$ 0,25')
  })
  it('mesma receita → "mesmos ingredientes e mesmas doses"', () => {
    expect(resumoDoDiff(diffDeFichas(A, { ...A, fichaId: 'fA2' }))).toContain('mesmos ingredientes e mesmas doses')
  })
  it('⛔ custo a definir → diferença null, nunca um número inventado', () => {
    const C = ficha('fC', 'C', [comp('x', 'X', 1, 'UN', null)])
    expect(diffDeFichas(A, C).diferencaLote).toBeNull()
  })
})

describe('⛔⛔ INVARIANTE: Σ diferenças das linhas == diferença do custo do lote, AO CENTAVO', () => {
  it('no caso do bacon/ovo/milho', () => {
    const d = diffDeFichas(A, B)
    expect(d.diferencaLote).toBe(Math.round((A.custoLote! - B.custoLote!) * 100) / 100)
    expect(Math.round((d.linhas.reduce((s, x) => s + (x.diferenca ?? 0), 0) + d.arredondamento) * 100)).toBe(Math.round(d.diferencaLote! * 100))
    expect(d.fecha).toBe(true)
  })
  it('em 500 pares sorteados (custos e doses quebrados)', () => {
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    for (let k = 0; k < 500; k++) {
      const itens = Array.from({ length: 12 }, (_, i) => ({ id: `i${i}`, custo: Math.round(rnd() * 80_000) / 1000 }))
      const mk = (id: string) => ficha(id, id, itens.filter(() => rnd() > 0.3).map((it) => comp(it.id, it.id, Math.round(rnd() * 3000) / 10000, 'KG', it.custo)))
      const d = diffDeFichas(mk('a'), mk('b'))
      const soma = d.linhas.reduce((s, x) => s + (x.diferenca ?? 0), 0) + d.arredondamento
      expect(Math.round(soma * 100), `par ${k}`).toBe(Math.round(d.diferencaLote! * 100))
      expect(Math.abs(d.arredondamento), `par ${k}: a sobra é só arredondamento`).toBeLessThanOrEqual(0.07)
      expect(d.fecha).toBe(true)
    }
  })
  it('⛔ custo do lote que NÃO vem dos componentes → fecha=false (o alarme existe)', () => {
    expect(diffDeFichas({ ...A, custoLote: A.custoLote! + 0.5 }, B).fecha).toBe(false)
  })
})
