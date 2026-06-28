// Sprint 0.5 Dia 2 — detecção heurística de transferências em 2 níveis.
// Sprint R1 (10/06/2026) — refatorado pra usar lib/transfers/score-pair.ts
// (fórmula UNIFICADA com varredura retroativa, +own-entity-signals).
//
// PESOS (Sprint R1):
//   - mesmo dia 0.50 | D+1 0.40 | D+2/D+3 0.30
//   - valor exato 0.20
//   - own-entity (CNPJ +0.15, nome +0.10, conta própria +0.10) — max dos 2 lados
//   - keyword forte (TRANSF/PIX_DEB/PIX_ENVIADO/TED/DOC/ENTRE_CONTAS) +0.10
//   - keyword soft (PIX puro) +0.05
//
// THRESHOLDS:
//   - HIGH ≥ 0.85 (era ≥0.90 antes)
//   - MEDIUM ≥ 0.70
//
// CONSEQUÊNCIA da unificação:
//   - Preview SEM refs (refs={}) tem MENOR confiança do que antes (era
//     0.90 mesmo dia + valor, agora 0.70). Esperado — o sistema antigo
//     era otimista demais sem evidência. Hoje ainda detecta (≥CONFIRM)
//     mas marca como MEDIUM em vez de HIGH.
//   - Preview COM refs ganha boost significativo (CNPJ próprio + 0.15 etc).
//     Caso real Banrisul/Sicredi/Stone (CNPJ no memo) ainda dá HIGH.

import { describe, it, expect } from 'vitest'
import {
  detectarTransferenciasNoPreview,
  type OfxCandidateTransaction,
  type AccountTransactionsBundle,
} from '@/lib/ofx/detect-transfer'
import type { OwnEntityRefs } from '@/lib/transfers/own-entity-signals'

const CONTA_IMPORTADA = { id: 'acc-banrisul', name: 'Banrisul Matriz' }
const CONTA_SICOOB = 'acc-sicoob'

// refs vazio (caller legado não passa nada — mantém retrocompat)
const EMPTY_REFS: OwnEntityRefs = {
  cnpj: null,
  names: [],
  accountNames: [],
  ownerCpfs: [],
  ownerNames: [],
}

// refs Cacula Mix real (caso PIX_DEB CNPJ 29756732000198)
const CACULA_REFS: OwnEntityRefs = {
  cnpj: '29756732000198',
  names: ['Cacula Mix', 'Cacula'],
  accountNames: ['banrisul', 'sicredi', 'stone'],
  ownerCpfs: [],
  ownerNames: [],
}

function tx(
  id: string,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  date: string,
  description = 'Lançamento',
): OfxCandidateTransaction {
  return { id, type, amount, date: new Date(date), description }
}

function bundle(
  accountId: string,
  transactions: OfxCandidateTransaction[],
): AccountTransactionsBundle {
  return { accountId, accountName: 'Sicoob Filial', transactions }
}

describe('detectarTransferenciasNoPreview — MEDIUM sem refs (R1: era HIGH antes)', () => {
  it('mesmo dia + valor exato (sem refs nem keyword) → 0.70 MEDIUM', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'Saque')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0].confidence).toBe(0.7)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
    expect(r.candidates[0].suggestedAction).toBe('CONFIRM')
  })

  it('mesmo dia + valor + keyword PIX (strong PIX_ENVIADO) → 0.80 MEDIUM', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'PIX ENVIADO BANRISUL')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].confidence).toBe(0.8)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
    expect(r.candidates[0].reason).toContain('Palavra de transferência')
  })

  it('detecta direção: DEBIT é "from", CREDIT é "to"', () => {
    const novas = [tx('saida-banrisul', 'DEBIT', 3000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('entrada-sicoob', 'CREDIT', 3000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].fromTransactionId).toBe('saida-banrisul')
    expect(r.candidates[0].toTransactionId).toBe('entrada-sicoob')
    expect(r.candidates[0].fromAccountId).toBe(CONTA_IMPORTADA.id)
    expect(r.candidates[0].toAccountId).toBe(CONTA_SICOOB)
  })

  it('detecta direção invertida: CREDIT nova + DEBIT na outra', () => {
    const novas = [tx('entrada-banrisul', 'CREDIT', 2000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('saida-sicoob', 'DEBIT', 2000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].fromTransactionId).toBe('saida-sicoob')
    expect(r.candidates[0].toTransactionId).toBe('entrada-banrisul')
    expect(r.candidates[0].fromAccountId).toBe(CONTA_SICOOB)
    expect(r.candidates[0].toAccountId).toBe(CONTA_IMPORTADA.id)
  })
})

describe('detectarTransferenciasNoPreview — Sprint R1: HIGH com own-entity (CNPJ/nome/conta)', () => {
  it('mesmo dia + valor + CNPJ próprio no memo (sem keyword) → 0.85 HIGH', () => {
    // Sprint R1: own-entity sozinho (CNPJ +0.15) já leva a HIGH no preview.
    // Memo deliberadamente sem keyword pra isolar contribuição do CNPJ.
    const novas = [
      tx('n1', 'DEBIT', 8000, '2026-06-08', 'PAGAMENTO BENEFICIARIO X'),
    ]
    const outras = [
      bundle(CONTA_SICOOB, [
        tx('o1', 'CREDIT', 8000, '2026-06-08', 'CRED 29756732000198'),
      ]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA, CACULA_REFS)
    expect(r.candidates[0].confidence).toBe(0.85)
    expect(r.candidates[0].confidenceLevel).toBe('HIGH')
    expect(r.candidates[0].evidence.hasOwnCnpj).toBe(true)
  })

  it('mesmo dia + valor + CNPJ próprio + nome empresa + PIX_DEB → 1.00 capped HIGH', () => {
    // Caso real Cacula Mix: PIX_DEB com CNPJ + nome no memo → score teórico
    // 0.50 + 0.20 + (0.15 CNPJ + 0.10 nome = 0.25) + 0.10 (strong) = 1.05 → cap 1.00
    const novas = [
      tx('n1', 'DEBIT', 8000, '2026-06-08', 'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX'),
    ]
    const outras = [
      bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 8000, '2026-06-08', 'PIX RECEBIDO')]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA, CACULA_REFS)
    expect(r.candidates[0].confidence).toBe(1.0)
    expect(r.candidates[0].confidenceLevel).toBe('HIGH')
    expect(r.candidates[0].evidence.hasOwnCnpj).toBe(true)
    expect(r.candidates[0].evidence.hasOwnName).toBe(true)
  })

  it('mesmo dia + valor + 3 sinais own-entity + strong → capped em 1.0 HIGH', () => {
    const novas = [
      tx('n1', 'DEBIT', 1000, '2026-05-11', 'PIX ENVIADO CACULA banrisul 29756732000198'),
    ]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 1000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA, CACULA_REFS)
    expect(r.candidates[0].confidence).toBe(1.0)
    expect(r.candidates[0].confidenceLevel).toBe('HIGH')
  })

  it('D+1 + valor + CNPJ próprio (sem keyword) → 0.75 MEDIUM (own-entity salva detecção)', () => {
    // Sprint R1: D+1 0.40 + valor 0.20 + CNPJ 0.15 = 0.75. CACULA REFS
    // detecta o CNPJ no memo da outra tx. Sem keyword (memo "CRED").
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [
      bundle(CONTA_SICOOB, [
        tx('o1', 'CREDIT', 5000, '2026-05-12', 'CRED 29756732000198'),
      ]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA, CACULA_REFS)
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0].confidence).toBe(0.75)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
  })
})

describe('detectarTransferenciasNoPreview — NÍVEL MÉDIO (0.70-0.84)', () => {
  it('mesmo dia + valor + keyword TED → 0.80 MEDIUM', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'TED ENVIADA')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].confidence).toBe(0.8)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
    expect(r.candidates[0].reason).toContain('Palavra de transferência')
  })

  it('mesmo dia + valor + TRANSF entre contas (strong) → 0.80 MEDIUM', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'TRANSF entre contas')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].confidence).toBe(0.8)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
  })

  it('D-1 (data outra é UM DIA ANTES da nova) com strong keyword → MEDIUM', () => {
    const novas = [tx('n1', 'CREDIT', 5000, '2026-05-12', 'TED RECEBIDA')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'DEBIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
  })
})

describe('detectarTransferenciasNoPreview — REJEIÇÕES (R1: D+1 sem refs/keyword agora descarta)', () => {
  it('D+1 + valor exato SEM refs SEM keyword → não passa CONFIRM (0.60 IGNORE)', () => {
    // Sprint R1 — REGRESSÃO intencional. Sistema antigo passava 0.75
    // (false-positive prone). Sem evidência além de "valor coincide D+1",
    // não é forte o bastante. Pra passar, banco precisa gravar CNPJ próprio
    // OU memo precisa ter "TED"/"PIX"/etc.
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-12')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('valor diferente acima de 1.5 centavos → não sugere nada', () => {
    // Sprint R1: tolerância subiu de 0.01 (preview legado) pra 0.015 (alinhado
    // com retroactive). 1.5 centavo cobre rounding entre bancos. Pra teste
    // de "valor diferente", uso diff 2 centavos pra garantir descarte.
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 4999.98, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('tolerância 1.5 centavos é OK (rounding entre bancos)', () => {
    const novas = [tx('n1', 'DEBIT', 5000.01, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000.0, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(1)
  })

  it('data com >3 dias de diferença → não sugere', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-15')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('mesmos sinais (2 DEBIT ou 2 CREDIT) → não sugere', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'DEBIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('zero outras contas → não sugere', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const r = detectarTransferenciasNoPreview(novas, [], CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('mesma conta (importada aparece em outrasContas por erro) → ignora', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [
      bundle(CONTA_IMPORTADA.id, [tx('o1', 'CREDIT', 5000, '2026-05-11')]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })
})

describe('detectarTransferenciasNoPreview — RANKING', () => {
  it('ordena candidatos por confiança decrescente', () => {
    const novas = [
      tx('high', 'DEBIT', 1000, '2026-05-11', 'PIX'), // soft → 0.75
      tx('med', 'DEBIT', 2000, '2026-05-11'), // sem keyword → 0.70
    ]
    const outras = [
      bundle(CONTA_SICOOB, [
        tx('high-par', 'CREDIT', 1000, '2026-05-11'),
        tx('med-par', 'CREDIT', 2000, '2026-05-11'),
      ]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(2)
    expect(r.candidates[0].confidence).toBeGreaterThan(r.candidates[1].confidence)
    expect(r.candidates[0].fromTransactionId).toBe('high')
  })
})

describe('detectarTransferenciasNoPreview — REASON e suggestedAction', () => {
  it('reason inclui "Mesmo dia + Valor exato + Palavra de transferência" (PIX strong)', () => {
    const novas = [tx('n1', 'DEBIT', 1000, '2026-05-11', 'PIX ENVIADO')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 1000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].reason).toContain('Mesmo dia')
    expect(r.candidates[0].reason).toContain('Valor exato')
    expect(r.candidates[0].reason).toContain('Palavra de transferência')
  })

  it('reason MEDIUM sem keyword: "Mesmo dia + Valor exato"', () => {
    const novas = [tx('n1', 'DEBIT', 1000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 1000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].reason).toBe('Mesmo dia + Valor exato')
  })

  it('thresholds de suggestedAction: AUTO_PAIR (≥0.85), CONFIRM (≥0.70)', () => {
    // Sprint R1: AUTO_PAIR threshold caiu de 0.90 pra 0.85 (alinhado
    // com PAIR_THRESHOLD da varredura).
    const novas = [
      tx('a', 'DEBIT', 1000, '2026-05-11', 'PIX ENVIADO 29756732000198'), // ≥0.85 HIGH AUTO_PAIR
      tx('b', 'DEBIT', 2000, '2026-05-11'), // 0.70 MEDIUM CONFIRM
      tx('c', 'DEBIT', 3000, '2026-05-11', 'TED'), // 0.80 MEDIUM CONFIRM
    ]
    const outras = [
      bundle(CONTA_SICOOB, [
        tx('a-par', 'CREDIT', 1000, '2026-05-11'),
        tx('b-par', 'CREDIT', 2000, '2026-05-11'),
        tx('c-par', 'CREDIT', 3000, '2026-05-11'),
      ]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA, CACULA_REFS)
    expect(r.candidates).toHaveLength(3)
    const byId = Object.fromEntries(r.candidates.map((c) => [c.fromTransactionId, c]))
    expect(byId['a'].suggestedAction).toBe('AUTO_PAIR')
    expect(byId['a'].confidenceLevel).toBe('HIGH')
    expect(byId['b'].suggestedAction).toBe('CONFIRM')
    expect(byId['c'].suggestedAction).toBe('CONFIRM')
  })
})

describe('detectarTransferenciasNoPreview — snapshots from/to e evidence', () => {
  it('embarca snapshots completos dos 2 lados (id, accountId, date, amount, description)', () => {
    const novas = [tx('saida', 'DEBIT', 9100, '2026-06-03', 'PIX ENVIADO')]
    const outras = [
      bundle(CONTA_SICOOB, [tx('entrada', 'CREDIT', 9100, '2026-06-03', 'PIX RECEBIDO')]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    const c = r.candidates[0]
    expect(c.from.transactionId).toBe('saida')
    expect(c.from.accountId).toBe('acc-banrisul')
    expect(c.from.amount).toBe(9100)
    expect(c.from.description).toBe('PIX ENVIADO')
    expect(c.from.date.toISOString().slice(0, 10)).toBe('2026-06-03')
    expect(c.to.transactionId).toBe('entrada')
    expect(c.to.accountId).toBe('acc-sicoob')
    expect(c.to.amount).toBe(9100)
    expect(c.to.description).toBe('PIX RECEBIDO')
    expect(c.to.date.toISOString().slice(0, 10)).toBe('2026-06-03')
  })

  it('evidence: sameDay=true, deltaDays=0, amountExact=true, keywordMatched="STRONG"', () => {
    const novas = [tx('n1', 'DEBIT', 1000, '2026-05-11', 'PIX ENVIADO')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 1000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].evidence.sameDay).toBe(true)
    expect(r.candidates[0].evidence.deltaDays).toBe(0)
    expect(r.candidates[0].evidence.amountExact).toBe(true)
    expect(r.candidates[0].evidence.keywordMatched).toBe('STRONG')
    expect(r.candidates[0].evidence.hasOwnCnpj).toBe(false)
  })

  it('Sprint R1: evidence inclui hasOwnCnpj quando refs detecta CNPJ', () => {
    const novas = [tx('n1', 'DEBIT', 8000, '2026-06-08', 'PIX 29756732000198 CACULA')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 8000, '2026-06-08')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA, CACULA_REFS)
    expect(r.candidates[0].evidence.hasOwnCnpj).toBe(true)
    expect(r.candidates[0].evidence.hasOwnName).toBe(true)
  })

  it('CREDIT do preview vira "to" (entrada) — direção independe de quem é preview', () => {
    const novas = [tx('credit-importando', 'CREDIT', 500, '2026-06-03', 'PIX')]
    const outras = [bundle(CONTA_SICOOB, [tx('debit-existente', 'DEBIT', 500, '2026-06-03')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    const c = r.candidates[0]
    // Saída = DEBIT (a existente do sicoob); Entrada = CREDIT (a do preview banrisul)
    expect(c.from.transactionId).toBe('debit-existente')
    expect(c.from.accountId).toBe('acc-sicoob')
    expect(c.to.transactionId).toBe('credit-importando')
    expect(c.to.accountId).toBe('acc-banrisul')
  })
})
