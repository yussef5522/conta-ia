/**
 * ⛔⛔ R1/R2 — A VIGÍLIA DAS ROTAS (28/09/2026), pedido do dono no check-up.
 *
 * *"se alguma rota passar de N segundos, o juiz acusa — pra próxima lentidão a gente saber
 * ANTES de eu sentir no dedo."*
 *
 * ⚠️ As linhas de log aqui são **o formato real** do nginx da casa (combined + `rt=`), com as
 * rotas e os números que o check-up de hoje mediu — não um formato inventado.
 */
import { describe, it, expect } from 'vitest'
import {
  lerLinha, normalizarRota, p95, resumirPorRota, avaliarRotas, checkRotas,
  R1_P95_SEGUNDOS, R1_MINIMO_DE_CHAMADAS, R2_MINIMO_DE_CHAMADAS,
} from '../rotas-lentas'

const linha = (rota: string, status: number, rt: number) =>
  `177.155.103.10 - - [28/Sep/2026:14:20:51 -0300] "GET ${rota} HTTP/2.0" ${status} 156 "https://app.caixaos.com.br/x" "Mozilla/5.0" rt=${rt}`

describe('⭐ lerLinha — o formato REAL do nginx', () => {
  it('lê rota, status e tempo', () => {
    expect(lerLinha(linha('/api/dashboard/badges?empresaId=abc', 200, 0.133)))
      .toEqual({ rota: '/api/dashboard/badges', status: 200, tempo: 0.133 })
  })

  it('⛔⛔ linha SEM `rt=` é IGNORADA — nunca contada como zero', () => {
    /**
     * ⚠️ É a trava que impede o guard de dar **verde por diluição**: log antigo (antes do
     * formato novo) e log de outro vhost convivem no mesmo arquivo. Contá-los como 0 s faria o
     * p95 despencar — *o silêncio virando "está tudo bem"*.
     */
    const antiga = '1.2.3.4 - - [28/Sep/2026:14:20:51 -0300] "GET /api/x HTTP/1.1" 200 156 "-" "curl"'
    expect(lerLinha(antiga)).toBeNull()
  })

  it('⛔ lixo e linha vazia não viram acesso', () => {
    expect(lerLinha('')).toBeNull()
    expect(lerLinha('qualquer coisa rt=abc')).toBeNull()
  })

  it('⭐ pega todos os verbos, não só GET', () => {
    expect(lerLinha(linha('/api/x', 200, 1).replace('GET', 'POST'))?.rota).toBe('/api/x')
  })
})

describe('⭐⭐ normalizarRota — id vira <id>, senão nenhum percentil junta chamadas', () => {
  it('cuid da empresa some', () => {
    expect(normalizarRota('/empresas/cmq17yapb00gnrndlh33sctbo/estoque/radar'))
      .toBe('/empresas/<id>/estoque/radar')
  })

  it('⭐ duas empresas viram a MESMA tela — é o que faz o p95 significar algo', () => {
    const a = normalizarRota('/empresas/cmq17yapb00gnrndlh33sctbo/fluxo-caixa')
    const b = normalizarRota('/empresas/cmu8w6qv107ja12f0r2kppjjd/fluxo-caixa')
    expect(a).toBe(b)
  })

  it('querystring sai (o mesmo endpoint com filtros diferentes é o mesmo endpoint)', () => {
    expect(normalizarRota('/api/contas-a-pagar?empresaId=x&escopo=PAGA')).toBe('/api/contas-a-pagar')
  })

  it('número longo (nº de nota) também', () => {
    expect(normalizarRota('/estoque/recibos/968530123')).toBe('/estoque/recibos/<n>')
  })

  it('⚠️ mas NÃO come pedaço curto de rota — "/api/v2" não vira "/api/<n>"', () => {
    expect(normalizarRota('/api/v2/x')).toBe('/api/v2/x')
  })
})

describe('⭐ p95 — percentil por posição', () => {
  it('com 20 valores, o p95 é o 19º', () => {
    const v = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(p95(v)).toBe(19)
  })
  it('lista vazia devolve 0 (e o avaliar ignora por falta de amostra)', () => {
    expect(p95([])).toBe(0)
  })
  /**
   * ⚠️⚠️ **A FRONTEIRA DO p95, e ela foi CORRIGIDA por estes testes.** Minha 1ª fixture punha
   * **1 outlier em 20** e esperava que acendesse — e não acende, **com razão**: 1/20 é
   * *exatamente* 5%, o limite do p95. O guard pega **"1 em cada 20 ou pior"**, nunca menos.
   *
   * ⭐ Isso importa pro caso real: na medição de 28/09 os travamentos de ~40s apareceram **2 em
   * ~20 rodadas (10%)** — dentro do alcance. Um travamento em cada 50 acessos passaria batido,
   * e é honesto dizer isso em vez de prometer que o guard vê tudo.
   */
  it('⚠️ 1 outlier em 20 (exatos 5%) NÃO move o p95 — é a fronteira, e ela é conhecida', () => {
    expect(p95([...Array(19).fill(0.1), 40])).toBe(0.1)
  })

  it('⭐ 2 em 20 (10%) o p95 VÊ — e a média esconderia', () => {
    const v = [...Array(18).fill(0.1), 40, 40]
    expect(p95(v)).toBe(40)
    const media = v.reduce((a, b) => a + b, 0) / v.length
    expect(Math.round(media * 10) / 10, 'a média diluiria o travamento').toBe(4.1)
  })
})

describe('⛔⛔ R1 — rota lenta acende', () => {
  it('⭐ p95 acima de 2s vira ERRO, com o número na mensagem', () => {
    // ⚠️ 4 em 40 = 10% — acima da fronteira do p95 (ver o bloco do p95 acima)
    const acessos = Array.from({ length: 40 }, (_, i) =>
      lerLinha(linha('/empresas/cmq17yapb00gnrndlh33sctbo/fluxo-caixa', 200, i < 36 ? 0.7 : 5.2))!)
    const [c] = avaliarRotas(acessos)
    expect(c.invariante).toBe('R1')
    expect(c.nivel).toBe('erro')
    expect(c.detalhe).toContain('/empresas/<id>/fluxo-caixa')
    expect(c.detalhe).toContain('5.2s')
  })

  it('⛔ amostra pequena NÃO acende — 3 chamadas não fazem percentil', () => {
    const acessos = Array.from({ length: R1_MINIMO_DE_CHAMADAS - 1 }, () =>
      lerLinha(linha('/api/raro', 200, 30))!)
    expect(avaliarRotas(acessos)).toEqual([])
  })

  it('⭐⭐ o dia NORMAL medido hoje fica VERDE — alarme que dispara sempre morre', () => {
    /**
     * ⚠️ São os tempos REAIS do check-up de 28/09: Contas a Pagar 89ms, Transações 74ms,
     * Posição 48ms, Radar 285ms, Caixa 290ms, Fluxo 760ms. **Nenhum deles pode acender.**
     */
    const reais: [string, number][] = [
      ['/api/contas-a-pagar', 0.089], ['/api/transacoes', 0.074],
      ['/api/empresas/cmq17yapb00gnrndlh33sctbo/estoque/posicao', 0.048],
      ['/api/empresas/cmq17yapb00gnrndlh33sctbo/estoque/radar', 0.285],
      ['/api/conciliacao/caixa', 0.290],
      ['/api/empresas/cmq17yapb00gnrndlh33sctbo/fluxo-caixa', 0.760],
    ]
    const acessos = reais.flatMap(([r, t]) =>
      Array.from({ length: 60 }, () => lerLinha(linha(r, 200, t))!))
    expect(avaliarRotas(acessos)).toEqual([])
  })

  it('⛔ e o teto é o do dono: 2s', () => {
    expect(R1_P95_SEGUNDOS).toBe(2)
  })
})

describe('⛔⛔ R2 — rota levando 4xx em laço', () => {
  it('⭐ reproduz o caso REAL de hoje: o badge com 403 da máquina do estoque', () => {
    /**
     * ⭐ Medido no log em 28/09: **1.391 de 1.466 chamadas ao badge** voltaram 403 (95%) — o
     * operador logado, o polling de 60s, e a rota exigindo `transaction.view`.
     */
    const acessos = [
      ...Array.from({ length: 1391 }, () => lerLinha(linha('/api/dashboard/badges', 403, 0.01))!),
      ...Array.from({ length: 75 }, () => lerLinha(linha('/api/dashboard/badges', 200, 0.13))!),
    ]
    const [c] = avaliarRotas(acessos)
    expect(c.invariante).toBe('R2')
    expect(c.nivel, 'R2 é AVISO — 4xx pode ser a trava de permissão funcionando').toBe('aviso')
    expect(c.detalhe).toContain('95%')
    expect(c.detalhe).toContain('/api/dashboard/badges')
  })

  it('⛔ 4xx ocasional (um 404 no meio) NÃO acende', () => {
    const acessos = [
      ...Array.from({ length: 100 }, () => lerLinha(linha('/api/x', 200, 0.1))!),
      lerLinha(linha('/api/x', 404, 0.01))!,
    ]
    expect(avaliarRotas(acessos)).toEqual([])
  })

  it('⛔ e 5xx NÃO é R2 — erro de servidor é outro assunto, com outro dono', () => {
    const acessos = Array.from({ length: R2_MINIMO_DE_CHAMADAS + 10 }, () =>
      lerLinha(linha('/api/y', 500, 0.1))!)
    expect(avaliarRotas(acessos).filter((c) => c.invariante === 'R2')).toEqual([])
  })
})

describe('⭐⭐ checkRotas — fail-soft e HONESTO quando não há dado', () => {
  it('⛔⛔ log SEM `rt=` devolve zero linhas medidas — e o juiz DIZ "sem dado"', () => {
    /**
     * ⚠️ Este é o estado do dia em que o formato novo ainda não subiu (ou o log rotacionou).
     * **Zero alertas com zero linhas não é "está tudo bem"** — e é por isso que `linhasComTempo`
     * viaja junto: sem ele, o silêncio seria lido como saúde.
     */
    const velho = ['1.2.3.4 - - [x] "GET /api/x HTTP/1.1" 200 1 "-" "-"'].join('\n')
    const r = checkRotas('/qualquer', () => velho)
    expect(r.linhasComTempo).toBe(0)
    expect(r.checks).toEqual([])
  })

  it('⛔ arquivo ausente não derruba o juiz', () => {
    const r = checkRotas('/nao/existe/access.log', () => { throw new Error('ENOENT') })
    expect(r).toEqual({ checks: [], linhasComTempo: 0, topLentas: [] })
  })

  it('⭐ e devolve o TOP 5 por p95 — o mapa que o check-up de hoje teve que simular', () => {
    const conteudo = [
      ...Array.from({ length: 30 }, () => linha('/api/a', 200, 0.9)),
      ...Array.from({ length: 30 }, () => linha('/api/b', 200, 0.1)),
    ].join('\n')
    const r = checkRotas('/x', () => conteudo)
    expect(r.linhasComTempo).toBe(60)
    expect(r.topLentas[0].rota).toBe('/api/a')
    expect(r.topLentas[0].p95).toBe(0.9)
  })
})

describe('⭐ resumirPorRota — a conta que alimenta os dois', () => {
  it('agrupa por rota normalizada e conta 4xx', () => {
    const acessos = [
      lerLinha(linha('/empresas/cmq17yapb00gnrndlh33sctbo/x', 200, 1))!,
      lerLinha(linha('/empresas/cmu8w6qv107ja12f0r2kppjjd/x', 403, 2))!,
    ]
    const [r] = resumirPorRota(acessos)
    expect(r.rota).toBe('/empresas/<id>/x')
    expect(r.chamadas).toBe(2)
    expect(r.pct4xx).toBe(0.5)
    expect(r.pior).toBe(2)
  })
})
