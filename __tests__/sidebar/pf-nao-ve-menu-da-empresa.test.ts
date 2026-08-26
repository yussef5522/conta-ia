// REGRA 5 — o menu do PF não pode voltar a apontar pra empresa.
//
// O BUG (26/08): ao trocar pro workspace PF, `currentEmpresaId` continuava apontando
// pra última PJ. Como TODO item de empresa é gated por `currentEmpresaId &&`, o menu
// INTEIRO da PJ seguia visível — e "Cartões" dentro do PF levava à tela de cartões da
// CAÇULA. Cadastrar ali criaria um BusinessCreditCard na empresa errada.
// O módulo de cartão PF nunca esteve quebrado: não havia como chegar nele.
//
// ⚠️ Este guard é ESTRUTURAL de propósito: um item novo de empresa adicionado sem o
// choke-point `empresaAtiva` quebra o teste. É a única forma de a correção sobreviver
// ao próximo sprint que adicionar menu — foi assim que ela se perdeu da primeira vez
// (o efeito dos badges já zerava a empresa no PF; ninguém aplicou aos itens).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(process.cwd(), 'components/sidebar/global-sidebar.tsx'), 'utf-8')

describe('o choke-point existe e é a única fonte da empresa no menu', () => {
  it('`empresaAtiva` é null quando o workspace é PF', () => {
    expect(src).toMatch(/const empresaAtiva = workspaceType === 'pf' \? null : currentEmpresaId/)
  })

  it('⭐ NENHUM href de /empresas/ usa currentEmpresaId direto — todos passam pelo choke-point', () => {
    // só os DESTINOS do menu (href=). O `empresaIdForBadges` aparece num fetch de
    // badge e é legítimo: aquele já era zerado no PF antes desta correção.
    const hrefs = [...src.matchAll(/href=\{`\/empresas\/\$\{(\w+)\}/g)].map((m) => m[1])
    expect(hrefs.length).toBeGreaterThan(10) // o menu tem muitos; garante que o teste vê algo
    const forasDaLei = [...new Set(hrefs.filter((v) => v !== 'empresaAtiva'))]
    expect(forasDaLei).toEqual([])
  })

  it('nenhum item é gated pelo `currentEmpresaId` cru (só o choke-point)', () => {
    expect(src).not.toMatch(/\{currentEmpresaId && \(/)
  })

  it('o querystring de empresa também zera no PF', () => {
    expect(src).toMatch(/const empresaQs = empresaAtiva \? `\?empresaId=\$\{empresaAtiva\}` : ''/)
  })
})

describe('o PF tem menu próprio', () => {
  const itensPF = [
    ['Cartões', '/perfis/${currentProfileId}/cartoes'],
    ['Contas', '/perfis/${currentProfileId}/contas'],
    ['Movimentações', '/perfis/${currentProfileId}/transacoes'],
    ['Despesas', '/perfis/${currentProfileId}/despesas'],
    ['Receitas', '/perfis/${currentProfileId}/receitas'],
  ] as const

  for (const [label, href] of itensPF) {
    it(`"${label}" leva ao PERFIL, não à empresa`, () => {
      expect(src).toContain(href)
    })
  }

  it('⭐ o item de CARTÕES do PF existe (era o que faltava — o módulo já funcionava)', () => {
    // o bloco tem que estar gated por PF, senão apareceria na empresa também
    const bloco = src.slice(src.indexOf('/perfis/${currentProfileId}/cartoes') - 400,
                            src.indexOf('/perfis/${currentProfileId}/cartoes') + 200)
    expect(bloco).toMatch(/workspaceType === 'pf' && currentProfileId/)
  })
})

describe('os itens PJ que não têm gate de empresa somem no PF', () => {
  it('Contas a Pagar/Receber, Conciliação e Pendentes ficam atrás de `workspaceType !== pf`', () => {
    const i = src.indexOf("<SectionLabel>Financeiro</SectionLabel>")
    const j = src.indexOf('label="Transferências"')
    const bloco = src.slice(i, j)
    expect(bloco).toMatch(/workspaceType !== 'pf' && \(/)
    // e os 4 estão DENTRO desse bloco
    for (const l of ['Contas a Pagar', 'Contas a Receber', 'Conciliação', 'Pendentes']) {
      expect(bloco).toContain(`label="${l}"`)
    }
  })
})
