// Sprint 5.0.3.0b — Tests dos saved views (4 views hardcoded).

import { janelaDoMes, mesCorrente } from '@/lib/periodo/mes-corrente'
import { describe, it, expect } from 'vitest'
import {
  SAVED_VIEWS,
  SAVED_VIEW_IDS,
  isValidSavedViewId,
  getSavedView,
  findActiveSavedView,
} from '@/lib/contas-pagar/saved-views'

// Quarta-feira 27/05/2026 12:00 UTC — datas determinísticas pra testes
const NOW = new Date('2026-05-27T12:00:00.000Z')

describe('SAVED_VIEWS — estrutura', () => {
  it('tem exatamente 4 views', () => {
    expect(SAVED_VIEWS).toHaveLength(4)
  })

  it('IDs estáveis: todas, vencidas, a-vencer-7d, pagas-mes', () => {
    expect(SAVED_VIEW_IDS).toEqual([
      'todas',
      'vencidas',
      'a-vencer-7d',
      'pagas-mes',
    ])
  })

  it('todas as views têm name não-vazio', () => {
    for (const v of SAVED_VIEWS) {
      expect(v.name.length).toBeGreaterThan(0)
    }
  })
})

describe('View "Todas"', () => {
  it('filtros: status=TODOS, sem período, sem vencidas, sort dueDate desc', () => {
    const f = getSavedView('todas').buildFilters(NOW)
    expect(f.status).toBe('TODOS')
    expect(f.vencidasOnly).toBe(false)
    expect(f.dataDe).toBe('')
    expect(f.dataAte).toBe('')
    expect(f.sortBy).toBe('dueDate')
    expect(f.sortDir).toBe('desc')
  })
})

describe('View "Vencidas"', () => {
  it('filtros: status=PENDING + vencidasOnly=true + sort asc (antiga primeiro)', () => {
    const f = getSavedView('vencidas').buildFilters(NOW)
    expect(f.status).toBe('PENDING')
    expect(f.vencidasOnly).toBe(true)
    expect(f.sortBy).toBe('dueDate')
    expect(f.sortDir).toBe('asc')
  })
})

describe('View "A vencer 7d"', () => {
  it('período = hoje até +7d em dueDate', () => {
    const f = getSavedView('a-vencer-7d').buildFilters(NOW)
    expect(f.dataDe).toBe('2026-05-27') // hoje
    expect(f.dataAte).toBe('2026-06-03') // +7 dias
    expect(f.status).toBe('PENDING')
    expect(f.dataField).toBe('dueDate')
  })

  it('é determinístico com a mesma data', () => {
    const f1 = getSavedView('a-vencer-7d').buildFilters(NOW)
    const f2 = getSavedView('a-vencer-7d').buildFilters(NOW)
    expect(f1).toEqual(f2)
  })

  it('atravessa virada de mês corretamente', () => {
    // 28/02/2026 → +7d = 07/03/2026
    const f = getSavedView('a-vencer-7d').buildFilters(
      new Date('2026-02-28T12:00:00.000Z'),
    )
    expect(f.dataDe).toBe('2026-02-28')
    expect(f.dataAte).toBe('2026-03-07')
  })
})

describe('View "Pagas no mês"', () => {
  /**
   * ⚠️⚠️ **OS 5 TESTES DESTE BLOCO FORAM INVERTIDOS EM 26/09, COM O MOTIVO ESCRITO.**
   *
   * Eles afirmavam o período por `dataDe`/`dataAte` + `status: 'RECONCILED'` — e essa régua
   * fazia a view entregar **só as pagas SEM VÍNCULO** (o `lifecycleScope` exclui a conciliada
   * fora dos escopos de pagas). Medido em prod: a view dizia **33** e o cartão ao lado, com o
   * MESMO nome, dizia **229**. *Um nome, dois números.*
   *
   * ⭐ Agora ela manda **`escopo: 'PAGA'`**, a mesma porta dos cards.
   *
   * ⭐⭐ **E A METADE CERTA DELES NÃO SE PERDEU — ela mudou de casa, que é o que os testes
   * abaixo passam a provar.** O que eles guardavam era a **BORDA DO MÊS** (fevereiro
   * bissexto, janeiro 31, dezembro virando o ano); quem responde isso agora é a
   * `janelaDoMes`, e é contra ela que a borda é conferida. *Remoção sem realocação é perda.*
   */
  it('⭐ a view manda o ESCOPO das pagas — nunca régua própria de status/período', () => {
    const f = getSavedView('pagas-mes').buildFilters(NOW)
    expect(f.escopo, 'a view voltou a recortar sozinha e passou a divergir do cartão')
      .toBe('PAGA')
    expect(f.status).toBe('TODOS')
    // ⛔ período próprio seria a 2ª régua de mês no mesmo pedido
    expect(f.dataDe).toBe('')
    expect(f.dataAte).toBe('')
    // ⭐ a ordenação pela data do PAGAMENTO continua — é a pergunta da view
    expect(f.dataField).toBe('paymentDate')
    expect(f.sortBy).toBe('paymentDate')
    expect(f.sortDir).toBe('desc')
  })

  it('⭐⭐ a BORDA DO MÊS continua provada — agora na régua que a view usa', () => {
    /**
     * ⚠️ O fim da janela é **EXCLUSIVO** (`< ate`), então fevereiro termina "no dia 1º de
     * março" em vez de "no 28 às 23:59:59" — a forma que não perde o último segundo.
     */
    const dia = (d: Date) => d.toISOString().slice(0, 10)
    // fevereiro NÃO bissexto
    expect(dia(janelaDoMes('2025-02').de)).toBe('2025-02-01')
    expect(dia(janelaDoMes('2025-02').ate)).toBe('2025-03-01')
    // fevereiro BISSEXTO — o dia 29 tem que caber dentro
    expect(dia(janelaDoMes('2024-02').ate)).toBe('2024-03-01')
    expect(new Date('2024-02-29T23:59:00Z') < janelaDoMes('2024-02').ate).toBe(true)
    // janeiro e dezembro (a virada de ano)
    expect(dia(janelaDoMes('2026-01').ate)).toBe('2026-02-01')
    expect(dia(janelaDoMes('2026-12').de)).toBe('2026-12-01')
    expect(dia(janelaDoMes('2026-12').ate)).toBe('2027-01-01')
  })

  it('⛔ e o mês é o do BRASIL — no dia 1º às 00h30 de SP ainda é o mês anterior lá fora', () => {
    // 2026-06-01T02:00Z = 31/05 23h em São Paulo
    expect(mesCorrente(new Date('2026-06-01T02:00:00.000Z'))).toBe('2026-05')
    expect(mesCorrente(new Date('2026-06-01T05:00:00.000Z'))).toBe('2026-06')
  })
})

describe('isValidSavedViewId', () => {
  it.each(['todas', 'vencidas', 'a-vencer-7d', 'pagas-mes'])(
    'aceita %s',
    (id) => {
      expect(isValidSavedViewId(id)).toBe(true)
    },
  )

  it.each(['Todas', 'invalid', '', 'nova-view', null])(
    'rejeita %s',
    (id) => {
      expect(isValidSavedViewId(id as string | null)).toBe(false)
    },
  )
})

describe('findActiveSavedView', () => {
  it('state idêntico ao da view "Todas" → "todas"', () => {
    const f = getSavedView('todas').buildFilters(NOW)
    expect(findActiveSavedView(f, NOW)).toBe('todas')
  })

  it('state com vencidasOnly=true e PENDING → "vencidas"', () => {
    const f = getSavedView('vencidas').buildFilters(NOW)
    expect(findActiveSavedView(f, NOW)).toBe('vencidas')
  })

  it('state custom (filtro manual) → null', () => {
    // Status PENDING mas dataDe="2026-01-01" — não bate nenhuma view
    expect(
      findActiveSavedView(
        {
          q: '',
          dataDe: '2026-01-01',
          dataAte: '2026-01-31',
          status: 'PENDING',
          vencidasOnly: false,
          dataField: 'dueDate',
        },
        NOW,
      ),
    ).toBeNull()
  })

  it('ignora q (busca textual) na detecção', () => {
    const f = { ...getSavedView('todas').buildFilters(NOW), q: 'GESTRA' }
    expect(findActiveSavedView(f, NOW)).toBe('todas')
  })

  it('aceita dataField undefined como dueDate (default)', () => {
    const f = getSavedView('todas').buildFilters(NOW)
    const { dataField: _dataField, ...withoutDataField } = f
    void _dataField
    expect(findActiveSavedView(withoutDataField, NOW)).toBe('todas')
  })
})
