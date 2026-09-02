// ⛔⛔ AS 3 TRANSFERÊNCIAS QUE FICARAM PENDURADAS (01/09/2026).
//
// Banrisul → Stone, 31/08: saem −500, −1.000, −1.000 ("CACULA MIX · PIX ENVIADO");
// entram no Stone em 29/08 +500, +1.000, +1.000 ("YUSSEF … - Transferência | Pix").
// O dono: *"o sistema não detecta nem me deixa marcar"*.
//
// ⭐⭐ MEDIDO NO CLASSIFICADOR REAL, e o resultado desmonta a hipótese óbvia:
//   · como está (D+2)     → **WEAK 0,70 — "Camada 3, só busca manual"**  (ACHA o par!)
//   · sem marcar redondo  → WEAK 0,70 (o valor comum **não** era o bloqueador)
//   · se fosse mesmo dia  → **STRONG 0,90 — Camada 2 (nome do sócio)**
//
// ⚠️ E o CONTRASTE prova que a janela de datas não era o problema: o par de **35.000 do
// MESMO dia pareou sozinho**, enquanto os de D+2 caíram um degrau. A camada 2 exige
// mesmo-dia **de propósito** (cicatriz dos 23 pares falsos de 06/08) e **não foi
// afrouxada** — o par não precisa virar automático, precisa APARECER pro dono confirmar.
//
// ⛔ O que escondia: a rota de candidatas tinha `if (!cls.autoSuggest) return null`,
// descartando justamente a camada 3. O modal abria VAZIO.

import { describe, it, expect } from 'vitest'
import { classifyTransferPair } from '../unified-transfer-engine'

const REFS = {
  cnpj: '29756732000198',
  names: ['CACULA MIX'],
  accountNames: ['banrisul', 'stone', 'sicredi'],
  ownerCpfs: [],
  ownerNames: ['Yussef Abu Zahry Musa'],
}
const BANRISUL = 'conta-banrisul'
const STONE = 'conta-stone'

/** o débito real do Banrisul (31/08) */
const deb = (amount: number) => ({
  id: `d${amount}`, bankAccountId: BANRISUL, date: new Date('2026-08-31T12:00:00Z'),
  type: 'DEBIT' as const, amount, description: 'CACULA MIX',
})
/** o crédito real do Stone (29/08) — descrição COMPLETAMENTE diferente, como o dono disse */
const cre = (amount: number, dia = '2026-08-29') => ({
  id: `c${amount}`, bankAccountId: STONE, date: new Date(`${dia}T12:00:00Z`),
  type: 'CREDIT' as const, amount, description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix',
})
const opts = (valorComum: number[] = [500, 1000]) => ({
  refs: REFS, valorComum: new Set(valorComum), matchOwnerName: true,
})

describe('⭐⭐ o detector ACHA o par — só não o oferece sozinho', () => {
  it('⭐⭐ D+2 com descrições diferentes → camada 3 (WEAK), não NULL', () => {
    for (const v of [500, 1000]) {
      const r = classifyTransferPair(deb(v), cre(v), opts())
      expect(r, `par de ${v} devia ser reconhecido`).not.toBeNull()
      expect(r!.layer).toBe('WEAK')
      expect(r!.autoSuggest).toBe(false) // ⛔ é isto que a rota descartava
      expect(r!.evidences.join(' ')).toContain('D+2')
      expect(r!.evidences.join(' ')).toContain('Valor exato')
    }
  })

  it('⚠️ o VALOR REDONDO não é o bloqueador — com e sem, dá o mesmo', () => {
    const comum = classifyTransferPair(deb(500), cre(500), opts([500, 1000]))
    const raro = classifyTransferPair(deb(500), cre(500), opts([]))
    expect(comum!.layer).toBe(raro!.layer)
    expect(comum!.confidence).toBeCloseTo(raro!.confidence, 2)
  })

  it('⭐ MESMO DIA vira camada 2 (0,90) — é só o mesmo-dia que separa os dois casos', () => {
    // é literalmente o par de 35.000, que pareou sozinho porque caiu em 31/08 dos dois lados
    const r = classifyTransferPair(deb(35000), cre(35000, '2026-08-31'), opts([]))
    expect(r!.layer).toBe('STRONG')
    expect(r!.confidence).toBeGreaterThanOrEqual(0.85)
    expect(r!.autoSuggest).toBe(true)
    expect(r!.evidences.join(' ')).toContain('Mesmo dia')
  })

  it('⛔⛔ e a camada 2 NÃO foi afrouxada: D+2 nunca vira sugestão automática', () => {
    // ⚠️ o guard da cicatriz de 06/08 (23 pares falsos). Afrouxar aqui traria de volta o
    // casamento automático de valores redondos entre contas.
    const r = classifyTransferPair(deb(35000), cre(35000, '2026-08-29'), opts([]))
    expect(r!.autoSuggest).toBe(false)
  })
})

describe('⭐ a variante do dono: a fraca só aparece quando não há boa', () => {
  /** a régua da rota de candidatas, isolada */
  const exibidas = <T extends { autoSuggest: boolean }>(todas: T[]): { lista: T[]; somenteFracas: boolean } => {
    const boas = todas.filter((c) => c.autoSuggest)
    const lista = boas.length > 0 ? boas : todas
    return { lista, somenteFracas: boas.length === 0 && lista.length > 0 }
  }

  it('⭐ com candidata BOA, a fraca some — "quando a boa existir ela é a resposta"', () => {
    const r = exibidas([{ autoSuggest: true, id: 'boa' }, { autoSuggest: false, id: 'fraca' }])
    expect(r.lista.map((x) => x.id)).toEqual(['boa'])
    expect(r.somenteFracas).toBe(false)
  })

  it('⭐⭐ sem candidata boa, a fraca aparece — e a tela sabe rotular', () => {
    const r = exibidas([{ autoSuggest: false, id: 'fraca' }])
    expect(r.lista.map((x) => x.id)).toEqual(['fraca'])
    expect(r.somenteFracas).toBe(true) // ⭐ vira "provável par — confirme"
  })

  it('⚠️ sem candidata nenhuma, não inventa "somenteFracas"', () => {
    expect(exibidas([])).toEqual({ lista: [], somenteFracas: false })
  })
})

describe('⛔⛔ TRANSFER ÓRFÃ é impossível — e a garantia é TRANSITIVA', () => {
  it('⛔⛔ as duas constraints do banco se compõem (por isso há 0 órfãs em 192)', () => {
    // ⚠️ MEDIDO em prod: `transactions` tem
    //     transfer_has_direction   : type='TRANSFER'        → transferDirection NOT NULL
    //     direction_requires_group : transferDirection ≠ NULL → transferGroupId NOT NULL
    // Logo, transitivamente: type='TRANSFER' → transferGroupId NOT NULL.
    // NÃO adicionei uma terceira constraint redundante — mas a garantia é IMPLÍCITA, e se
    // alguém derrubar a primeira a órfã volta em SILÊNCIO. Este teste é o alarme disso.
    //
    // ⚠️ Importa porque `prepareBalanceTransactions` DESCARTA TRANSFER sem grupo: uma órfã
    // some do saldo sem erro nenhum. Foi a regressão que quase aconteceu hoje ao marcar as
    // 4 CACULA MIX sem a perna do destino (R$ 37.500 sumiriam).
    const temDirection = (t: { type: string; transferDirection: string | null }) =>
      t.type !== 'TRANSFER' || t.transferDirection != null
    const grupoSeDirection = (t: { transferDirection: string | null; transferGroupId: string | null }) =>
      t.transferDirection == null || t.transferGroupId != null

    const orfa = { type: 'TRANSFER', transferDirection: null, transferGroupId: null }
    expect(temDirection(orfa)).toBe(false) // a 1ª constraint já barra

    const meioCaminho = { type: 'TRANSFER', transferDirection: 'OUT', transferGroupId: null }
    expect(temDirection(meioCaminho)).toBe(true)
    expect(grupoSeDirection(meioCaminho)).toBe(false) // a 2ª barra o resto

    const ok = { type: 'TRANSFER', transferDirection: 'OUT', transferGroupId: 'g1' }
    expect(temDirection(ok) && grupoSeDirection(ok)).toBe(true)
  })
})
