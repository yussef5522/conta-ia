// INFRA — invariantes de máquina. REGRA 3: roda a decisão real contra leituras REAIS
// (inclusive a do servidor no momento do incidente de 24/08).

import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { avaliarInfra, lerInfra, N1_SWAP_MB, N3_SWAP_MINIMO_MB } from '../health'

/** o servidor ANTES do swap — o estado que derrubou o build 3× */
const ANTES_DO_SWAP = { memTotalMb: 3915, memDisponivelMb: 3236, swapTotalMb: 0, swapUsadoMb: 0 }
/** o servidor DEPOIS do swap, saudável */
const HOJE = { memTotalMb: 3915, memDisponivelMb: 3187, swapTotalMb: 2047, swapUsadoMb: 2 }

describe('avaliarInfra', () => {
  it('máquina saudável não gera nada', () => {
    expect(avaliarInfra(HOJE)).toEqual([])
  })

  it('N3 PEGA a máquina sem swap (o estado que derrubou prod em 24/08)', () => {
    const c = avaliarInfra(ANTES_DO_SWAP)
    expect(c).toHaveLength(1)
    expect(c[0].invariante).toBe('N3')
    expect(c[0].nivel).toBe('erro')
    expect(c[0].detalhe).toContain('OOM')
  })

  it('N1 PEGA swap em uso na operação normal (gatilho do upgrade)', () => {
    const c = avaliarInfra({ ...HOJE, swapUsadoMb: N1_SWAP_MB + 100 })
    expect(c.some((x) => x.invariante === 'N1')).toBe(true)
    expect(c.find((x) => x.invariante === 'N1')!.detalhe).toContain('4→8 GB')
  })

  it('swap em uso PEQUENO não alarma (respiro normal não é pressão)', () => {
    expect(avaliarInfra({ ...HOJE, swapUsadoMb: N1_SWAP_MB - 1 })).toEqual([])
  })

  it('N2 avisa quando sobra pouca memória', () => {
    const c = avaliarInfra({ ...HOJE, memDisponivelMb: 300 })
    const n2 = c.find((x) => x.invariante === 'N2')!
    expect(n2.nivel).toBe('aviso') // avisa, não deixa vermelho
    expect(n2.detalhe).toContain('8%') // 300/3915
  })

  it('sem swap NÃO acumula N1 em cima do N3 (uma causa, um alerta)', () => {
    const c = avaliarInfra({ ...ANTES_DO_SWAP, swapUsadoMb: 999 })
    expect(c.filter((x) => x.invariante === 'N1')).toHaveLength(0)
    expect(c.filter((x) => x.invariante === 'N3')).toHaveLength(1)
  })
})

describe('lerInfra', () => {
  it('parseia o formato real do /proc/meminfo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meminfo-'))
    const f = join(dir, 'meminfo')
    writeFileSync(f, [
      'MemTotal:        4009288 kB',
      'MemFree:         3030016 kB',
      'MemAvailable:    3263488 kB',
      'Buffers:           12345 kB',
      'SwapTotal:       2097148 kB',
      'SwapFree:        2094076 kB',
    ].join('\n'))
    const l = lerInfra(f)!
    expect(l.memTotalMb).toBe(3915)
    expect(l.memDisponivelMb).toBe(3187)
    expect(l.swapTotalMb).toBe(2048)
    expect(l.swapUsadoMb).toBe(3)
  })

  it('fora do Linux (sem /proc) devolve null em vez de estourar', () => {
    expect(lerInfra('/caminho/que/nao/existe')).toBeNull()
  })
})
