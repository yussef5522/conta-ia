// INFRA — invariantes de máquina. REGRA 3: roda a decisão real contra leituras REAIS
// (inclusive a do servidor no momento do incidente de 24/08).

import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  avaliarInfra, lerInfra, N1_SWAP_MB, N3_SWAP_MINIMO_MB, N4_DISCO_USADO_PCT,
} from '../health'

/**
 * ⚠️ O DISCO ENTROU NOS FIXTURES COM O NÚMERO MEDIDO EM PROD (26/10, depois da faxina):
 * 11 de 116 GB = 9% usado. Fixture com disco estourado faria TODO teste de memória
 * carregar um N4 que não tem nada a ver com o que ele mede.
 */
const DISCO_OK = { discoUsadoPct: 9, discoUsadoGb: 11, discoTotalGb: 116 }

/** o servidor ANTES do swap — o estado que derrubou o build 3× */
const ANTES_DO_SWAP = {
  memTotalMb: 3915, memDisponivelMb: 3236, swapTotalMb: 0, swapUsadoMb: 0, ...DISCO_OK,
}
/** o servidor DEPOIS do swap, saudável */
const HOJE = {
  memTotalMb: 3915, memDisponivelMb: 3187, swapTotalMb: 2047, swapUsadoMb: 2, ...DISCO_OK,
}

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

  it('N4 PEGA o disco acima do teto', () => {
    const c = avaliarInfra({ ...HOJE, discoUsadoPct: N4_DISCO_USADO_PCT + 1, discoUsadoGb: 95 })
    const n4 = c.find((x) => x.invariante === 'N4')!
    expect(n4.nivel).toBe('erro')
    expect(n4.detalhe).toContain('81%')
    // a frase ENSINA a saída, em vez de só acusar
    expect(n4.detalhe).toContain('journalctl --vacuum-size')
    expect(n4.detalhe).toContain('faxina-builds.sh')
  })

  it('disco NO teto ainda não alarma (o degrau é "acima de", não "igual a")', () => {
    const c = avaliarInfra({ ...HOJE, discoUsadoPct: N4_DISCO_USADO_PCT })
    expect(c.filter((x) => x.invariante === 'N4')).toHaveLength(0)
  })

  // ⛔ A RÉGUA QUE IMPORTA: `null` é "NÃO MEDI", nunca "disco vazio". Sem isso, uma
  // leitura que falhou viraria 0% e o N4 ficaria CALADO sobre um disco que pode estar
  // cheio — a mesma régua do "sem contagem" do estoque.
  it('disco NÃO MEDIDO (null) se CALA em vez de afirmar 0%', () => {
    const c = avaliarInfra({
      ...HOJE, discoUsadoPct: null, discoUsadoGb: null, discoTotalGb: null,
    })
    expect(c.filter((x) => x.invariante === 'N4')).toHaveLength(0)
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
    // ⚠️ caminho de disco inexistente DE PROPÓSITO: este teste mede o /proc/meminfo,
    // e ler o disco real da máquina de quem roda tornaria o número não-determinístico.
    const l = lerInfra(f, '/caminho/que/nao/existe')!
    expect(l.discoUsadoPct).toBeNull()
    expect(l.memTotalMb).toBe(3915)
    expect(l.memDisponivelMb).toBe(3187)
    expect(l.swapTotalMb).toBe(2048)
    expect(l.swapUsadoMb).toBe(3)
  })

  it('fora do Linux (sem /proc) devolve null em vez de estourar', () => {
    expect(lerInfra('/caminho/que/nao/existe')).toBeNull()
  })

  // REGRA 3: o statfsSync é EXECUTADO contra o disco REAL de quem roda — é a única
  // forma de provar que a leitura funciona neste Node (ela foi conferida no servidor,
  // Node v20.20.2, antes de entrar).
  it('lê o disco REAL da máquina (a aritmética do df, com números plausíveis)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meminfo-disco-'))
    const f = join(dir, 'meminfo')
    writeFileSync(f, [
      'MemTotal:        4009288 kB',
      'MemAvailable:    3263488 kB',
      'SwapTotal:       2097148 kB',
      'SwapFree:        2094076 kB',
    ].join('\n'))
    const l = lerInfra(f, dir)!
    expect(l.discoUsadoPct).not.toBeNull()
    expect(l.discoUsadoPct!).toBeGreaterThanOrEqual(0)
    expect(l.discoUsadoPct!).toBeLessThanOrEqual(100)
    expect(l.discoTotalGb!).toBeGreaterThan(0)
    expect(l.discoUsadoGb!).toBeLessThanOrEqual(l.discoTotalGb!)
  })
})
