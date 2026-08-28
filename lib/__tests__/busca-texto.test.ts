// REGRA 1 — O DONO NÃO ACHAVA O "PAO DE XIS" NA BUSCA (28/08).
//
// "xis" → nada · "pao" → nada · e o item aparecia rolando a lista completa.
//
// ⭐ CAUSA PROVADA contra o banco de PROD: `contains` do Prisma é case-SENSITIVE no
// PostgreSQL e case-INSENSITIVE no SQLite:
//     contains("xis") → 0   ·   contains("XIS") → 1  ("PAO DE XIS")
//     contains("pao") → 0   ·   contains("PAO") → 1
// Funcionava em DEV e falhava CALADO em PROD — a pior classe, porque o dev nunca vê.
//
// ⚠️ E `mode: 'insensitive'` NÃO bastaria: resolve caixa, não ACENTO — medido no mesmo
// banco, ele acha "PAO DE XIS" com "pao" mas NÃO acha "Pão tradicional".

import { describe, it, expect } from 'vitest'
import { normalizarBusca, casaBusca, filtrarPorBusca } from '../busca-texto'

// os nomes REAIS do catálogo da Caçula
const CATALOGO = [
  'PAO DE XIS',
  'Pão tradicional c/ gergelim (unidade)',
  'Coxão Mole',
  'Acém',
  'QUEIJO MUSSARELA EM PECA 02 KG',
  'DESENGRAXANTE',
]
const acha = (termo: string) => filtrarPorBusca(CATALOGO, termo, (n) => n)

describe('⭐⭐ o caso do dono: os 4 jeitos de procurar o PAO DE XIS', () => {
  it('⭐ "xis" acha (era 0 resultados — o dado-chave, porque não tem acento)', () => {
    expect(acha('xis')).toContain('PAO DE XIS')
  })
  it('⭐ "pao" acha', () => {
    expect(acha('pao')).toContain('PAO DE XIS')
  })
  it('"PAO" (maiúsculo) acha', () => {
    expect(acha('PAO')).toContain('PAO DE XIS')
  })
  it('⭐ "pão" (com til) acha o item SEM til — o que insensitive sozinho NÃO faz', () => {
    expect(acha('pão')).toContain('PAO DE XIS')
  })
  it('"pao de xis" inteiro acha', () => {
    expect(acha('pao de xis')).toContain('PAO DE XIS')
  })
})

describe('e o inverso: item COM acento achado por termo SEM', () => {
  it('"pao" acha "Pão tradicional"', () => {
    expect(acha('pao')).toContain('Pão tradicional c/ gergelim (unidade)')
  })
  it('"coxao" acha "Coxão Mole" · "acem" acha "Acém"', () => {
    expect(acha('coxao')).toContain('Coxão Mole')
    expect(acha('acem')).toContain('Acém')
  })
})

describe('⭐ por PALAVRA, em qualquer ordem', () => {
  it('"xis pao" acha (o dono não precisa lembrar como o fornecedor escreveu)', () => {
    expect(acha('xis pao')).toContain('PAO DE XIS')
  })
  it('"queijo kg" acha o queijo', () => {
    expect(acha('queijo kg')).toContain('QUEIJO MUSSARELA EM PECA 02 KG')
  })
  it('⚠️ palavra que não existe DERRUBA o match (é "todas", não "qualquer uma")', () => {
    expect(acha('pao frango')).toEqual([])
  })
})

describe('bordas', () => {
  it('busca vazia devolve tudo (a lista completa continua acessível)', () => {
    expect(acha('')).toHaveLength(CATALOGO.length)
    expect(acha('   ')).toHaveLength(CATALOGO.length)
  })
  it('termo que não casa devolve VAZIO, não a lista toda', () => {
    expect(acha('bicicleta')).toEqual([])
  })
  it('espaço a mais no meio não atrapalha', () => {
    expect(acha('pao    de   xis')).toContain('PAO DE XIS')
  })
  it('normalizarBusca é o contrato: minúscula, sem acento, espaço colapsado', () => {
    expect(normalizarBusca('  Pão   Tradicional ')).toBe('pao tradicional')
    expect(normalizarBusca('AÇÚCAR')).toBe('acucar')
  })
  it('casaBusca é o MESMO critério do filtro (uma decisão, um lugar)', () => {
    expect(casaBusca('PAO DE XIS', 'xis')).toBe(true)
    expect(casaBusca('DESENGRAXANTE', 'xis')).toBe(false)
  })
})
