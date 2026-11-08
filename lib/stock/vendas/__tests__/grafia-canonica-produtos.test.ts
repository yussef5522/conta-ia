/**
 * ⭐⭐ 08/11/2026 — A GRAFIA CANÔNICA CHEGA AOS PRODUTOS: as regras da porta, puras.
 *
 * O caso real (Caçula, raio-X de 08/11): o PDV manda `XIS COMPLETO`, `XIS - COMPLETO` e
 * `Xis Completo` pro mesmo lanche. A régua exata deixava a terceira "sem destino".
 * REGRA 3: executa a função, não procura string.
 */
import { describe, it, expect } from 'vitest'
import {
  canonicoDaGrafia, resolvedorDeGrafia, mapaQueDecide, agrupamentoAutomatico, conflitosDeGrafia,
  chaveDeApresentacao, type GrafiaMapeada,
} from '../grafia-canonica'
import { normalizarNome } from '../grupo-complemento'

const ficha = (nomeSuitable: string, fichaId: string): GrafiaMapeada => ({ nomeSuitable, alvoTipo: 'FICHA', fichaId, itemId: null })

describe('canonicoDaGrafia — caixa, acento e PONTUAÇÃO; nunca letra nem dígito', () => {
  it('as 3 grafias reais do Xis Completo são o mesmo canônico', () => {
    const ks = ['XIS COMPLETO', 'XIS - COMPLETO', 'Xis Completo'].map(canonicoDaGrafia)
    expect(new Set(ks)).toEqual(new Set(['XIS COMPLETO']))
  })
  it('parênteses e acento: «Pizza Família (45cm)» = «PIZZA FAMILIA 45CM»', () => {
    expect(canonicoDaGrafia('Pizza Família (45cm)')).toBe(canonicoDaGrafia('PIZZA FAMILIA 45CM'))
  })
  it('⛔ typo e dígito continuam DIFERENTES', () => {
    expect(canonicoDaGrafia('STROGONOFF DE CARNEE')).not.toBe(canonicoDaGrafia('STROGONOFF DE CARNE'))
    expect(canonicoDaGrafia('4 QUEIJOS')).not.toBe(canonicoDaGrafia('5 QUEIJOS'))
  })
  it('⛔ pontuação vira ESPAÇO, não some: «1/2» não colide com «12»', () => {
    expect(canonicoDaGrafia('PIZZA 1/2 CALABRESA')).not.toBe(canonicoDaGrafia('PIZZA 12 CALABRESA'))
  })
  it('⛔ nome só de símbolo não vira chave vazia (dois nomes diferentes nunca viram "o mesmo")', () => {
    expect(canonicoDaGrafia('***')).not.toBe(canonicoDaGrafia('---'))
  })
})

describe('resolvedorDeGrafia — a porta da leitura do mapa de produto', () => {
  const mapa = [
    ficha('XIS COMPLETO', 'fA'),
    ficha('LASANHA DE CARNE', 'fL'),
    { nomeSuitable: 'GRANDE', alvoTipo: 'IGNORAR', fichaId: null, itemId: null },
    { nomeSuitable: 'COCA LATA', alvoTipo: 'REVENDA', fichaId: null, itemId: 'iCoca' },
  ]
  const r = resolvedorDeGrafia(mapa)

  it('grafia exata → EXATA (a decisão do dono pra este nome)', () => {
    expect(r('XIS COMPLETO')).toMatchObject({ tipo: 'EXATA', mapa: { fichaId: 'fA' } })
  })
  it('⭐ «Xis Completo» e «XIS - COMPLETO» → CANONICA, mesma ficha, com o rastro', () => {
    for (const n of ['Xis Completo', 'XIS - COMPLETO']) {
      expect(r(n)).toMatchObject({ tipo: 'CANONICA', mapa: { fichaId: 'fA' }, viaGrafia: 'XIS COMPLETO' })
    }
  })
  it('⭐ a lasanha minúscula também resolve', () => {
    expect(mapaQueDecide(r('lasanha de carne'))?.fichaId).toBe('fL')
  })
  it('revenda propaga igual a ficha', () => {
    expect(mapaQueDecide(r('Coca-Lata'))?.itemId).toBe('iCoca')
  })
  it('⛔ IGNORAR de uma irmã NÃO se propaga (ignorar é decisão por nome)', () => {
    expect(r('Grande').tipo).toBe('SEM')
  })
  it('⛔ typo não resolve sozinho', () => {
    expect(r('XIS COMPLETOO').tipo).toBe('SEM')
  })

  it('⛔⛔ CONFLITO: irmãs com fichas DIFERENTES → nunca escolhe, devolve as candidatas', () => {
    // o dado real de 08/11: as duas grafias JÁ mapeadas apontam pra fichas ativas diferentes
    const rc = resolvedorDeGrafia([ficha('XIS COMPLETO', 'f710'), ficha('XIS - COMPLETO', 'f7kj')])
    const x = rc('Xis Completo')
    expect(x.tipo).toBe('CONFLITO')
    expect(mapaQueDecide(x), 'conflito não pode decidir destino').toBeNull()
    if (x.tipo === 'CONFLITO') expect(x.candidatas.map((c) => c.nomeSuitable).sort()).toEqual(['XIS - COMPLETO', 'XIS COMPLETO'])
    // e as grafias EXATAS continuam com a decisão de cada uma
    expect(mapaQueDecide(rc('XIS - COMPLETO'))?.fichaId).toBe('f7kj')
  })
  it('irmãs que apontam pro MESMO destino não são conflito', () => {
    const rc = resolvedorDeGrafia([ficha('XIS COMPLETO', 'fA'), ficha('XIS - COMPLETO', 'fA')])
    expect(rc('Xis Completo').tipo).toBe('CANONICA')
  })
})

describe('⛔ COMPLEMENTOS: a mesma porta, e nada muda onde não há pontuação (REGRA 14)', () => {
  /**
   * A régua velha, verbatim (pré-08/11): o automático por `normalizarNome`. Nos nomes sem
   * diferença de pontuação os dois têm que dar o MESMO resultado, byte a byte.
   */
  const automaticoVelho = (pend: { nomeSuitable: string; ocorrencias: number }[], ja: { nomeSuitable: string; fichaId: string; nomeFicha: string }[]) => {
    const por = new Map<string, (typeof ja)[number]>()
    for (const m of ja) if (!por.has(normalizarNome(m.nomeSuitable))) por.set(normalizarNome(m.nomeSuitable), m)
    return pend.flatMap((p) => {
      const i = por.get(normalizarNome(p.nomeSuitable))
      return !i || i.nomeSuitable === p.nomeSuitable ? [] : [{ nomeSuitable: p.nomeSuitable, ocorrencias: p.ocorrencias, fichaId: i.fichaId, nomeFicha: i.nomeFicha, viaGrafia: i.nomeSuitable }]
    }).sort((a, b) => b.ocorrencias - a.ocorrencias)
  }
  // grafias REAIS dos complementos (sonda de 08/11): só caixa/acento diferem
  const ja = [
    { nomeSuitable: 'FRANGO COM CATUPIRY', fichaId: 'f1', nomeFicha: 'FRANGO COM CATUPIRY' },
    { nomeSuitable: 'FILE MIGNON', fichaId: 'f2', nomeFicha: 'FILE MIGNON' },
    { nomeSuitable: 'BACON', fichaId: 'f3', nomeFicha: 'BACON' },
  ]
  const pend = [
    { nomeSuitable: 'frango com catupiry', ocorrencias: 2 }, { nomeSuitable: 'filé mignon', ocorrencias: 2 },
    { nomeSuitable: 'Bacon', ocorrencias: 1 }, { nomeSuitable: 'STROGONOFF DE CARNEE', ocorrencias: 4 },
  ]

  it('agrupamentoAutomatico dá exatamente o que dava', () => {
    expect(agrupamentoAutomatico(pend, ja)).toEqual(automaticoVelho(pend, ja))
  })
  it('conflitosDeGrafia segue vazio onde era vazio, e acha onde achava', () => {
    expect(conflitosDeGrafia(ja)).toEqual([])
    expect(conflitosDeGrafia([...ja, { nomeSuitable: 'Bacon', fichaId: 'fX', nomeFicha: 'X' }]).map((c) => c.canonico)).toEqual(['BACON'])
  })
  it('chaveDeApresentacao: pendente agrupa pelo mesmo canônico de antes quando não há pontuação', () => {
    for (const n of ['frango com catupiry', 'filé mignon', 'STROGONOFF DE CARNEE']) {
      expect(chaveDeApresentacao({ destino: 'PENDENTE', fichaId: null, nomeSuitable: n })).toBe(`canonico:${normalizarNome(n)}`)
    }
  })
  it('⭐ a decisão de 08/11 vale pros dois: «XIS - CALABRESA» complemento acha a irmã «XIS CALABRESA»', () => {
    const r = agrupamentoAutomatico([{ nomeSuitable: 'XIS - CALABRESA', ocorrencias: 1 }], [{ nomeSuitable: 'XIS CALABRESA', fichaId: 'fc', nomeFicha: 'XIS CALABRESA' }])
    expect(r.map((x) => x.fichaId)).toEqual(['fc'])
  })
})
