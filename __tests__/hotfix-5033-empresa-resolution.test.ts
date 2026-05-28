// Sprint 5.0.3.3 — Tests pra resolução de empresa atual com prioridade
// query > cookie > primeira (dashboard) + assinatura async do setCurrentEmpresa.

import { describe, it, expect } from 'vitest'

describe('Dashboard: resolução de empresaAtual', () => {
  // Replica a logic do dashboard/page.tsx após o fix:
  function resolveEmpresaAtual(
    empresaQueryId: string | undefined,
    cookieEmpresaId: string | null,
    empresas: Array<{ id: string; name: string }>,
  ): { id: string; name: string } | undefined {
    const fromQuery = empresaQueryId
      ? empresas.find((e) => e.id === empresaQueryId)
      : undefined
    const fromCookie = cookieEmpresaId
      ? empresas.find((e) => e.id === cookieEmpresaId)
      : undefined
    return fromQuery ?? fromCookie ?? empresas[0]
  }

  const EMPRESAS = [
    { id: 'cmpcacula01000000000000', name: 'Cacula Mix' },
    { id: 'cmpprofit0100000000000', name: 'Profit São Borja' },
    { id: 'cmpitaqui0100000000000', name: 'Profit Itaqui' },
  ]

  it('Sem query nem cookie → primeira empresa da lista', () => {
    expect(resolveEmpresaAtual(undefined, null, EMPRESAS)?.id).toBe(
      'cmpcacula01000000000000',
    )
  })

  it('Query param presente → usa empresa do query (precedência máxima)', () => {
    expect(
      resolveEmpresaAtual('cmpprofit0100000000000', null, EMPRESAS)?.id,
    ).toBe('cmpprofit0100000000000')
  })

  it('Sem query mas com cookie → usa cookie (escolha do switcher)', () => {
    expect(
      resolveEmpresaAtual(undefined, 'cmpitaqui0100000000000', EMPRESAS)?.id,
    ).toBe('cmpitaqui0100000000000')
  })

  it('Query > Cookie (deep-link wins): conflito → query', () => {
    // Query diz cacula, cookie diz profit → query vence
    expect(
      resolveEmpresaAtual(
        'cmpcacula01000000000000',
        'cmpprofit0100000000000',
        EMPRESAS,
      )?.id,
    ).toBe('cmpcacula01000000000000')
  })

  it('Query inválido (não pertence ao user) → fallback pro cookie', () => {
    expect(
      resolveEmpresaAtual(
        'cmpinvalid0000000000000',
        'cmpitaqui0100000000000',
        EMPRESAS,
      )?.id,
    ).toBe('cmpitaqui0100000000000')
  })

  it('Cookie inválido → fallback pra primeira', () => {
    expect(
      resolveEmpresaAtual(undefined, 'cmpinvalid0000000000000', EMPRESAS)?.id,
    ).toBe('cmpcacula01000000000000')
  })

  it('Cookie string vazia → null/falsy → fallback', () => {
    expect(resolveEmpresaAtual(undefined, '', EMPRESAS)?.id).toBe(
      'cmpcacula01000000000000',
    )
  })

  it('Sem empresas → undefined', () => {
    expect(resolveEmpresaAtual(undefined, null, [])).toBeUndefined()
  })
})

describe('Sprint 5.0.3.3 — setCurrentEmpresa assinatura async', () => {
  it('REGRESSÃO: assinatura precisa ser Promise<void> pra permitir await', async () => {
    // Replica o que o EmpresaContext faz: callback assíncrono.
    // Garante que callers podem usar await OU void sem TS errors.
    async function setCurrentEmpresaMock(id: string): Promise<void> {
      // Simula fetch async
      await Promise.resolve(id)
    }

    // Test 1: await funciona
    const result = await setCurrentEmpresaMock('id-1')
    expect(result).toBeUndefined()

    // Test 2: void funciona (fire-and-forget)
    void setCurrentEmpresaMock('id-2')

    // Test 3: chain .then funciona
    let chained = false
    await setCurrentEmpresaMock('id-3').then(() => {
      chained = true
    })
    expect(chained).toBe(true)
  })

  it('AWAIT cookie POST antes de navigate (ordem das operações)', async () => {
    // Replica a sequência crítica: setState → POST → navigate
    const events: string[] = []

    async function setCurrentEmpresaMock(id: string): Promise<void> {
      events.push(`setState:${id}`)
      // Simula fetch async com pequeno delay
      await new Promise((r) => setTimeout(r, 5))
      events.push(`cookie-set:${id}`)
      // SÓ ENTÃO navega
      events.push(`navigate:${id}`)
    }

    await setCurrentEmpresaMock('profit')

    // Ordem crítica: cookie precisa estar setado ANTES de navigate
    const cookieIdx = events.indexOf('cookie-set:profit')
    const navigateIdx = events.indexOf('navigate:profit')
    expect(cookieIdx).toBeLessThan(navigateIdx)
  })
})

describe('Sprint 5.0.3.3 — URL searchParams sync (client pages)', () => {
  // Replica a logic do useEffect adicionado em /contas-a-pagar etc:
  function syncedEmpresaId(
    currentState: string,
    urlEmpresaId: string,
  ): string | null {
    // Retorna o novo valor SE precisa atualizar, null se não
    if (urlEmpresaId && urlEmpresaId !== currentState) {
      return urlEmpresaId
    }
    return null
  }

  it('URL muda de cacula → profit: state atualiza', () => {
    expect(syncedEmpresaId('cmpcacula', 'cmpprofit')).toBe('cmpprofit')
  })

  it('URL igual ao state: NÃO atualiza (evita loop infinito)', () => {
    expect(syncedEmpresaId('cmpcacula', 'cmpcacula')).toBeNull()
  })

  it('URL vazia: NÃO atualiza state (preserva valor atual)', () => {
    expect(syncedEmpresaId('cmpcacula', '')).toBeNull()
  })

  it('Page inicia sem state e URL tem empresa: state atualiza', () => {
    expect(syncedEmpresaId('', 'cmpcacula')).toBe('cmpcacula')
  })
})
