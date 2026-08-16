// Sprint Fase 3 CAMADA 2 (15/08/2026) — A TRAVA DE ANONIMIZAÇÃO.
// Se alguém re-extrair o fixture sem anonimizar, este teste BARRA o commit:
// nenhum CPF/CNPJ/nome/nº-de-contrato REAL da caçula pode aparecer no fixture.
// O que o fixture PRESERVA (valores, datas, taxas, estrutura) NÃO é PII.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const fixture = readFileSync(join(__dirname, 'loans-cacula-anon.json'), 'utf-8')

// Dados REAIS que NUNCA podem estar no fixture (do config/CLAUDE.md da caçula).
const PII_PROIBIDO = [
  '29756732000198', // CNPJ real da caçula
  'C41022227', 'C41022570', 'C41033828', 'C61021346', // nºs de contrato Sicredi reais
  '002100064956967', '002100057538834', // Banrisul reais
  '000000000001837311', '000000000001827478', // Caixa reais
  'arafet', 'thalji', // nome real do credor do mútuo
  'cmq17yapb00gnrndlh33sctbo', // companyId real
  'cmq17z90v00qxrndl02kfn4iz', // bankAccountId real (Banrisul)
]

describe('anonimização do fixture de empréstimos — trava anti-PII', () => {
  it.each(PII_PROIBIDO)('não vaza o dado real "%s"', (real) => {
    expect(fixture.toLowerCase()).not.toContain(real.toLowerCase())
  })

  it('preserva a estrutura (9 contratos, 346 parcelas) — o dado que o teste protege', () => {
    const data = JSON.parse(fixture)
    expect(data).toHaveLength(9)
    expect(data.reduce((s: number, l: { installments: unknown[] }) => s + l.installments.length, 0)).toBe(346)
  })
})
