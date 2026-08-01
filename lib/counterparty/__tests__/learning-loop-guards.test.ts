// Sprint Ciclo-Aprendizado (01/08) — guards que protegem as OUTRAS empresas.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', rel), 'utf-8')

describe('gatilho: regra CONTRAPARTE nunca nasce em silêncio (4.3)', () => {
  const endpoint = read('app/api/transacoes/[id]/classificar-com-aprendizado/route.ts')
  it('endpoint só faz upsert da regra quando input.createCounterpartyRule=true', () => {
    // o upsert tem que estar guardado pelo flag ativo do usuário
    expect(endpoint).toMatch(/if\s*\(padrao\s*&&\s*input\.createCounterpartyRule\)/)
  })
  it('default do flag é false (schema)', () => {
    expect(endpoint).toMatch(/createCounterpartyRule:\s*z\.boolean\(\)\.default\(false\)/)
  })
  it('regra é por empresa (companyId no where do upsert), nunca global (4.2)', () => {
    expect(endpoint).toMatch(/companyId_tipoMatch_padrao/)
    expect(endpoint).toMatch(/tipoMatch:\s*CONTRAPARTE_TIPO_MATCH/)
  })
  it('conta vezesAplicada quando o user seguiu regra existente (3.3)', () => {
    expect(endpoint).toMatch(/vezesAplicada:\s*\{\s*increment:\s*1\s*\}/)
  })
})

describe('modal: aditivo — tx SEM contraparte idêntica a hoje (4.1)', () => {
  const modal = read('components/pendentes/AprenderEAplicarModal.tsx')
  it('learnPattern (regra por descrição) reseta pra !base.counterpartyName', () => {
    // sem contraparte → !undefined = true (comportamento de hoje preservado);
    // com contraparte → false (evita regra por descrição genérica)
    expect(modal).toMatch(/setLearnPattern\(!base\.counterpartyName\)/)
  })
  it('opção de contraparte tem default OFF (2.2)', () => {
    expect(modal).toMatch(/useState\(false\)/) // createCpRule
    expect(modal).toMatch(/setCreateCpRule\(false\)/)
  })
  it('opção de contraparte só renderiza quando a tx TEM contraparte (1.4)', () => {
    expect(modal).toMatch(/base\.counterpartyName\s*&&\s*categoria\s*&&/)
  })
  it('convivência: os dois flags viajam separados no body (4.6)', () => {
    expect(modal).toMatch(/learnPattern,/)
    expect(modal).toMatch(/createCounterpartyRule:\s*createCpRule/)
  })
})
