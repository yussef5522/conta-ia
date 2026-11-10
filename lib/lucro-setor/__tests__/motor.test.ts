import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { montarSetores, type EntradasDoDia, type ProdutoDoDia, type ComplementoDoDia, type Secao } from '../motor'
import { SEM_SETOR, setorDoComplemento } from '../complemento-setor'

const fixture = (dia: string): EntradasDoDia =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', `entradas-${dia}.json`), 'utf8'))
const c = (v: number) => Math.round(v * 100)
const soma = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0)

const SECOES: Secao[] = [
  { chave: 'XIS', nome: 'Xis', ordem: 1 },
  { chave: 'PIZZAS', nome: 'Pizzas', ordem: 7 },
  { chave: 'BEBIDAS', nome: 'Bebidas', ordem: 8 },
]
const prod = (nome: string, un: number, vendeu: number, custoUn: number | null, secao: string | null): ProdutoDoDia => ({
  chave: `nome:${nome}`, nome, nomesSuitable: [nome], un, vendeu, custoUn, secao,
})
const comp = (nomeSuitable: string, ocorrencias: number, custoUn: number | null, alvo: ComplementoDoDia['alvo'] = custoUn == null ? 'SEM_MAPA' : 'FICHA', grupo: ComplementoDoDia['grupo'] = 'OUTRO'): ComplementoDoDia =>
  ({ nomeSuitable, ocorrencias, custoUn, alvo, grupo })

describe('K1 — Σ setores == total do dia (pinos de dias reais)', () => {
  it('07/11: R$ 26.266,10 · 725 un', () => {
    const r = montarSetores(fixture('2026-11-07'))
    expect(c(soma(r.setores, (s) => s.vendeu))).toBe(2626610)
    expect(soma(r.setores, (s) => s.un)).toBe(725)
    expect(r.totais).toMatchObject({ vendeu: 26266.1, un: 725 })
  })
  it('08/11: R$ 22.430,42 · 661 un', () => {
    const r = montarSetores(fixture('2026-11-08'))
    expect(c(soma(r.setores, (s) => s.vendeu))).toBe(2243042)
    expect(soma(r.setores, (s) => s.un)).toBe(661)
  })
  it('Σ produtos do setor == vendeu/un do setor (nada escapa entre linha e card)', () => {
    for (const s of montarSetores(fixture('2026-11-07')).setores) {
      expect(c(soma(s.produtos, (p) => p.vendeu))).toBe(c(s.vendeu))
      expect(soma(s.produtos, (p) => p.un)).toBe(s.un)
    }
  })
})

describe('K2 — custo do setor == Σ produtos + Σ complementos atribuídos, ao centavo', () => {
  it('dia real 07/11, setor por setor', () => {
    const r = montarSetores(fixture('2026-11-07'))
    for (const s of r.setores) {
      const prods = soma(s.produtos, (p) => (p.custo == null ? 0 : c(p.custo)))
      const comps = soma(s.complementos, (k) => (k.custo == null ? 0 : c(k.custo)))
      expect(c(s.custoProdutos)).toBe(prods)
      expect(c(s.custoComplementos!)).toBe(comps)
      expect(c(s.custo)).toBe(prods + comps)
      expect(c(s.lucro)).toBe(c(s.vendeuComCusto) - prods - comps)
    }
    expect(c(r.totais.custo)).toBe(soma(r.setores, (s) => c(s.custo)))
  })
  it('custo de linha = custoUn da porta × un (nunca média)', () => {
    const r = montarSetores({ dia: 'd', secoes: SECOES, complementos: [comp('CALABRESA', 3, 2.51, 'FICHA', 'SABOR')], produtos: [prod('XIS', 7, 210, 3.33, 'XIS')] })
    const xis = r.setores.find((s) => s.secao === 'XIS')!
    expect(xis.produtos[0].custo).toBe(23.31)
    expect(r.setores.find((s) => s.secao === 'PIZZAS')!.custoComplementos).toBe(7.53)
  })
})

describe('K3 — item sem ficha NUNCA entra no custo', () => {
  const r = montarSetores({
    dia: 'd', secoes: SECOES, complementos: [],
    produtos: [prod('XIS COMPLETO', 10, 300, 3.5, 'XIS'), prod('XIS SEM FICHA', 2, 50, null, 'XIS')],
  })
  const xis = r.setores.find((s) => s.secao === 'XIS')!
  it('fica fora do custo e do vendeuComCusto, e é NOMEADO em semFicha', () => {
    expect(xis.custoProdutos).toBe(35)
    expect(xis.vendeu).toBe(350)
    expect(xis.vendeuComCusto).toBe(300)
    expect(xis.unComCusto).toBe(10)
    expect(xis.semFicha).toEqual([{ nome: 'XIS SEM FICHA', un: 2, vendeu: 50 }])
    expect(xis.lucro).toBe(265) // sobre o que TEM custo — não 350 − 35
    expect(xis.custoCompleto).toBe(false)
  })
  it('cobertura do dia real fecha: unComCusto + Σ semFicha.un == un, por setor', () => {
    for (const s of montarSetores(fixture('2026-11-07')).setores) {
      expect(s.unComCusto + soma(s.semFicha, (x) => x.un)).toBe(s.un)
      expect(s.produtos.filter((p) => p.custoUn == null).every((p) => p.custo == null)).toBe(true)
    }
  })
})

describe('K4 — sem seção vai pra SEM SETOR, nunca some', () => {
  it('seção nula e seção inativa caem em SEM SETOR, e o total do dia não muda', () => {
    const r = montarSetores({
      dia: 'd', secoes: SECOES, complementos: [],
      produtos: [prod('XIS', 1, 30, 3, 'XIS'), prod('NOVO', 2, 20, null, null), prod('VELHO', 1, 5, 1, 'SECAO_APAGADA')],
    })
    const sem = r.setores.find((s) => s.secao === SEM_SETOR)!
    expect(sem.produtos.map((p) => p.nome).sort()).toEqual(['NOVO', 'VELHO'])
    expect(sem.vendeu).toBe(25)
    expect(r.totais).toMatchObject({ vendeu: 55, un: 4 })
    expect(r.setores.at(-1)!.secao).toBe(SEM_SETOR) // por último, mas presente
  })
})

describe('complementos → setor', () => {
  it('SABOR → PIZZAS; borda pelo nome → PIZZAS; o resto → SEM SETOR com o custo VISÍVEL', () => {
    const r = montarSetores({
      dia: 'd', secoes: SECOES, produtos: [prod('PIZZA', 1, 40, 10, 'PIZZAS')],
      complementos: [comp('CALABRESA', 2, 2.5, 'FICHA', 'SABOR'), comp('BORDA CATUPIRY g', 1, null), comp('COCA COLA 2L', 3, 6)],
    })
    const pz = r.setores.find((s) => s.secao === 'PIZZAS')!
    expect(pz.custoComplementos).toBe(5)
    expect(pz.complementosSemFicha).toEqual([{ nome: 'BORDA CATUPIRY g', ocorrencias: 1 }])
    const sem = r.setores.find((s) => s.secao === SEM_SETOR)!
    expect(sem.custoComplementos).toBe(18)
    expect(sem.lucro).toBe(-18)
    expect(c(r.totais.custo)).toBe(c(10 + 5 + 18))
  })
  it('IGNORAR do dono: sem custo, sem setor — mas contado', () => {
    const r = montarSetores({ dia: 'd', secoes: SECOES, produtos: [], complementos: [comp('GRANDE', 4, null, 'IGNORAR')] })
    expect(r.setores).toEqual([])
    expect(r.complementos).toEqual({ temRelatorio: true, ocorrencias: 4, ignorados: [{ nome: 'GRANDE', ocorrencias: 4 }] })
  })
  it('dia SEM relatório de complementos: custoComplementos null, nunca 0 (caso real 08/11)', () => {
    const r = montarSetores(fixture('2026-11-08'))
    expect(r.complementos.temRelatorio).toBe(false)
    expect(r.setores.every((s) => s.custoComplementos === null && s.custoCompleto === false)).toBe(true)
    const vazio = montarSetores({ dia: 'd', secoes: SECOES, produtos: [prod('XIS', 1, 30, 3, 'XIS')], complementos: [] })
    expect(vazio.setores[0].custoComplementos).toBe(0) // relatório que veio vazio é outra coisa
  })
  it('o mapa usa a porta de nome da casa (espaço, caixa, acento)', () => {
    expect(setorDoComplemento('borda  catupiry G', 'OUTRO').secao).toBe('PIZZAS')
    expect(setorDoComplemento('PIZZA FAMÍLIA (45CM)', 'OUTRO').secao).toBe('PIZZAS')
    expect(setorDoComplemento('COCA COLA 2L', 'OUTRO').secao).toBe(SEM_SETOR)
  })
})
