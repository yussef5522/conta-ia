/**
 * ⭐⭐ "UMA CAUSA, UM ALARME" NO PONTINHO DO FISCAL (09/10/2026, item 4a do dono).
 *
 * **A ordem:** *"aplicar a MESMA supressão do sininho — 73 das 90 linhas com pontinho são ficha
 * com lote na unidade errada, já avisadas na fila de conversão; o pontinho ali é ruído que
 * ensina a ignorar o fiscal. Pontinho fica pros casos com causa própria."*
 *
 * ⚠️ Medido em prod em 09/10: **100 pontinhos, 82 com lote torto** → sobram **18**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pontinhoVale } from '../fiscal-dos-lotes'
import { usosDe } from '@/__tests__/regras-ui/_leitura-de-fonte'

const f = (impossivel: boolean, fichaId: string) => ({ impossivel, fichaId })

describe('a supressão é PURA e decide pela CAUSA', () => {
  it('⭐ impossível com causa PRÓPRIA acende o pontinho', () => {
    expect(pontinhoVale(f(true, 'ficha-a'), new Set())).toBe(true)
  })

  it('⛔ impossível cuja FICHA está na fila de conversão NÃO acende — a causa já tem aviso', () => {
    expect(pontinhoVale(f(true, 'ficha-a'), new Set(['ficha-a']))).toBe(false)
  })

  it('⚠️ o que não é impossível nunca acende, com ou sem lote torto', () => {
    expect(pontinhoVale(f(false, 'ficha-a'), new Set())).toBe(false)
    expect(pontinhoVale(f(false, 'ficha-a'), new Set(['ficha-a']))).toBe(false)
  })

  it('⚠️ a supressão é por FICHA, não por ordem — duas ordens da mesma ficha calam juntas', () => {
    const torto = new Set(['ficha-x'])
    expect(pontinhoVale(f(true, 'ficha-x'), torto)).toBe(false)
    expect(pontinhoVale(f(true, 'ficha-y'), torto)).toBe(true)
  })
})

/**
 * ⛔⛔ O GUARD DA FONTE ÚNICA — e ele existe porque a régua **estava copiada** até 09/10.
 *
 * `fichasComLoteTorto` era um helper PRIVADO do produtor de avisos. Reimplementar as 2 linhas
 * no fiscal daria **duas respostas pra "esta ficha mede rendimento?"**, e elas divergiriam no
 * 1º ajuste da régua do M5 — com o sininho calado e o pontinho aceso, ou o contrário. É a
 * lição do B1 aplicada a um `Set`.
 */
describe('⛔ a régua da supressão tem UM dono', () => {
  const PRODUTOR = 'lib/avisos/produtores/producao.ts'
  const FISCAL = 'lib/stock/producao/fiscal-dos-lotes.ts'
  const ROTA = 'app/api/empresas/[id]/estoque/producao/ordens/route.ts'

  it('o produtor de avisos CONSUME a função, não a redefine', () => {
    const src = readFileSync(PRODUTOR, 'utf8')
    expect(src, 'a cópia privada voltou — duas réguas pra mesma pergunta').not.toMatch(
      /async function fichasComLoteTorto/,
    )
    expect(usosDe(src, 'fichasComLoteTorto'), 'o produtor parou de suprimir').toBeGreaterThan(0)
    expect(src).toMatch(/from '@\/lib\/stock\/producao\/fiscal-dos-lotes'/)
  })

  it('⭐ a dona da régua é o fiscal, e ela lê a fila de conversão (o M5)', () => {
    const src = readFileSync(FISCAL, 'utf8')
    expect(src).toMatch(/export async function fichasComLoteTorto/)
    expect(usosDe(src, 'fichasParaConverter')).toBeGreaterThan(0)
  })

  it('⛔ a ROTA da lista aplica a supressão — senão o pontinho volta a ser ruído', () => {
    const src = readFileSync(ROTA, 'utf8')
    expect(usosDe(src, 'pontinhoVale'), 'a rota parou de suprimir o pontinho').toBeGreaterThan(0)
    expect(usosDe(src, 'fichasComLoteTorto')).toBeGreaterThan(0)
    /** ⚠️ e não pode voltar a ler o `impossivel` cru no payload do pontinho */
    expect(src).not.toMatch(/fiscalImpossivel:\s*fiscal\.get\([^)]*\)\?\.impossivel/)
  })
})
