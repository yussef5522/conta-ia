// REGRA 1/3 — o invariante do deploy. Cada caso aqui é um incidente REAL de prod.

import { describe, it, expect } from 'vitest'
import { avaliarDeploy, MIN_BUILDS_ROLLBACK, type LeituraDeploy } from '../deploy-health'

const sao: LeituraDeploy = {
  ehSymlink: true,
  alvo: '.next-builds/20260826-163400-abc1234',
  buildIdOk: true,
  cssCount: 2,
  buildsGuardados: 3,
}

describe('deploy são não acusa nada', () => {
  it('symlink + BUILD_ID + CSS + 3 builds guardados', () => {
    expect(avaliarDeploy(sao)).toEqual([])
  })
})

describe('D1 — os dois estados que DERRUBARAM prod', () => {
  it('⭐ 24/08: BUILD_ID ausente (build morto no meio) → ERRO', () => {
    const r = avaliarDeploy({ ...sao, buildIdOk: false })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ invariante: 'D1', nivel: 'erro' })
    expect(r[0].detalhe).toMatch(/BUILD_ID/)
    expect(r[0].detalhe).toMatch(/rollback\.sh/) // o alerta ENSINA a sair
  })

  it('⭐ 26/08: build sem CSS (página sem estilo) → ERRO', () => {
    const r = avaliarDeploy({ ...sao, cssCount: 0 })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ invariante: 'D1', nivel: 'erro' })
    expect(r[0].detalhe).toMatch(/CSS/)
  })

  it('BUILD_ID ausente NÃO empilha com "sem CSS" — uma causa, um alerta', () => {
    // mesma disciplina do N1/N3 do juiz de infra: e-mail que vira ruído não é lido
    const r = avaliarDeploy({ ...sao, buildIdOk: false, cssCount: 0 })
    expect(r).toHaveLength(1)
    expect(r[0].detalhe).toMatch(/BUILD_ID/)
  })
})

describe('D2 — o desenho voltou a apodrecer', () => {
  it('⭐ `.next` virou diretório real (alguém buildou por cima do vivo) → AVISO', () => {
    const r = avaliarDeploy({ ...sao, ehSymlink: false })
    expect(r.map((c) => c.invariante)).toEqual(['D2'])
    expect(r[0].nivel).toBe('aviso')
    expect(r[0].detalhe).toMatch(/deploy\.sh/)
  })

  it('⚠️ isso o SMOKE nunca pegaria: o site responde 200 e mesmo assim perdeu a rede', () => {
    // um diretório real serve páginas normalmente — o que se perdeu é a troca
    // atômica e o rollback em segundos. Por isso o invariante olha ESTRUTURA.
    const r = avaliarDeploy({ ...sao, ehSymlink: false })
    expect(r.some((c) => c.nivel === 'erro')).toBe(false) // não derruba nada AGORA
    expect(r).toHaveLength(1) // mas não passa em branco
  })

  it('sem symlink não cobra D3 (não faz sentido pedir histórico a quem não versiona)', () => {
    const r = avaliarDeploy({ ...sao, ehSymlink: false, buildsGuardados: 0 })
    expect(r.map((c) => c.invariante)).toEqual(['D2'])
  })
})

describe('D3 — rollback precisa de pra onde voltar', () => {
  it(`menos de ${MIN_BUILDS_ROLLBACK} builds guardados → AVISO`, () => {
    const r = avaliarDeploy({ ...sao, buildsGuardados: 1 })
    expect(r.map((c) => c.invariante)).toEqual(['D3'])
    expect(r[0].detalhe).toMatch(/rebuild/)
  })

  it(`${MIN_BUILDS_ROLLBACK} já basta`, () => {
    expect(avaliarDeploy({ ...sao, buildsGuardados: MIN_BUILDS_ROLLBACK })).toEqual([])
  })
})
