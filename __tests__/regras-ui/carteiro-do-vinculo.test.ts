// ⛔⛔⛔ UM LEITOR SÓ PROS NOMES DO PDV — a rede estrutural do carteiro (10/05/2026).
//
// O defeito não foi um `if` errado: foi **a mesma pergunta respondida em dois lugares**. A
// revisão mandava `?mapearComplemento=`, o editor lia `getAll('complemento')` na mão, e a
// `fichas/nova/page.tsx` lia na mão também — três leituras, nenhuma casando. Resultado: ficha
// ÓRFÃ, revisão cobrando o mesmo nome pra sempre, venda sem baixar estoque.
//
// ⭐ A régua é REGRA 5: quem quer saber "quais nomes do PDV esta ficha mapeia" chama
// `nomesDeComplementoDaUrl`. Leitura na mão volta a poder dropar um param em silêncio — e é
// silêncio que torna este defeito caro.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

const DONO = 'lib/stock/producao/voltar-ficha.ts'
const EDITOR = 'components/estoque/ficha-editor.tsx'
const PAGINA = 'app/(dashboard)/empresas/[id]/estoque/fichas/nova/page.tsx'
const SENDER_VENDAS = 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx'

/** Os dois que decidem o vínculo a partir da URL. */
const LEITORES = [EDITOR, PAGINA]

describe('o carteiro do vínculo: UM leitor só', () => {
  it('⛔ ninguém lê os nomes do PDV na mão — `getAll(\'complemento\')` só no DONO', () => {
    for (const f of LEITORES) {
      const src = semComentarios(ler(f))
      expect(src, `${f} voltou a ler o param na mão — foi assim que o alias foi dropado em silêncio`)
        .not.toMatch(/getAll\(\s*['"](?:complemento|mapearComplemento)['"]\s*\)/)
    }
  })

  it('⭐ e os dois CONSOMEM a rede única (guard de dois lados)', () => {
    for (const f of LEITORES) {
      // ⚠️ `usosDe` ignora import e comentário: o que conta é a CHAMADA, nunca a menção
      expect(usosDe(ler(f), 'nomesDeComplementoDaUrl'), `${f} deixou de chamar a rede única`).toBeGreaterThanOrEqual(1)
    }
  })

  it('a rede lê as DUAS grafias (tirar uma é reabrir o buraco)', () => {
    const dono = semComentarios(ler(DONO))
    expect(dono).toMatch(/getAll\(\s*['"]complemento['"]\s*\)/)
    expect(dono).toMatch(/getAll\(\s*['"]mapearComplemento['"]\s*\)/)
  })

  it('o sender da revisão manda o nome do PDV na URL de criar ficha', () => {
    const src = semComentarios(ler(SENDER_VENDAS))
    // a linha do "criar ficha de sabor": nome + o param do vínculo + o tipo
    expect(src).toMatch(/fichas\/nova\?[^`'"]*complemento=/)
    expect(src).toMatch(/fichas\/nova\?[^`'"]*tipo=SABOR/)
  })

  it('⭐ e o POST do editor LEVA o nome no corpo — coletar sem enviar é o defeito de 12/09', () => {
    const src = semComentarios(ler(EDITOR))
    expect(src).toMatch(/mapearComplemento:/)
  })
})
