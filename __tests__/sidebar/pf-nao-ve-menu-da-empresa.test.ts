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
  /**
   * ⭐⭐ **A ESPINHA DE 13/09** — 5 itens, padrão Monarch/Mobills. O menu do PF tinha **9**,
   * com um *"Mês"* apontando pro redirect que morreu, DOIS caminhos pro mesmo import e TRÊS
   * formas de ver lançamento. Menu com três portas pra mesma sala é o B1 em forma de
   * navegação.
   */
  const itensPF = [
    ['Meu Dinheiro', '/perfis/${currentProfileId}`}'],
    ['Contas', '/perfis/${currentProfileId}/contas'],
    ['Cartões', '/perfis/${currentProfileId}/cartoes'],
    ['Lançamentos', '/perfis/${currentProfileId}/transacoes'],
    ['Relatórios', '/perfis/${currentProfileId}/insights'],
  ] as const

  for (const [label, href] of itensPF) {
    it(`"${label}" leva ao PERFIL, não à empresa`, () => {
      expect(src).toContain(href)
    })
  }

  /**
   * ⛔⛔ **O QUE SAIU DO MENU NÃO PODE FICAR ÓRFÃO** — a família "porta sem maçaneta", que
   * já custou 5 voltas. `Despesas` e `Receitas` são telas VIVAS; elas saíram da espinha e
   * passaram a ser alcançadas de dentro de Lançamentos, que é onde fazem sentido. **Este
   * teste é o que impede a limpeza do menu de virar um sumiço.**
   */
  it('⭐ Despesas e Receitas saíram do menu mas NÃO ficaram órfãs', () => {
    const lancamentos = readFileSync(
      resolve(process.cwd(), 'app/(dashboard)/perfis/[id]/transacoes/page.tsx'), 'utf-8')
    expect(lancamentos, 'a tela de Despesas ficou sem caminho').toContain('/despesas`}')
    expect(lancamentos, 'a tela de Receitas ficou sem caminho').toContain('/receitas`}')
  })

  it('⭐⭐ os 5 itens da espinha vivem DENTRO do gate de PF — nenhum vaza pra empresa', () => {
    /**
     * ⚠️⚠️ **JANELA DE N CARACTERES DE NOVO.** A 1ª versão olhava ±400 chars em volta do
     * item de Cartões; com os 5 itens num fragmento único, o gate passou a ficar mais longe
     * e o guard quebrou **com a tela certa**. É o mesmo defeito do detector de rastro de
     * 12/09 — *o que define o bloco é a ESTRUTURA, não a distância*.
     */
    const gate = src.indexOf("workspaceType === 'pf' && currentProfileId && (\n          <>")
    expect(gate, 'a espinha do PF não está num bloco único gated por PF').toBeGreaterThan(0)
    // o bloco vai do gate até o `)}` que o fecha, na MESMA indentação
    const fim = src.indexOf('\n        )}', gate)
    const bloco = src.slice(gate, fim)
    for (const rota of ['contas', 'cartoes', 'transacoes', 'insights']) {
      expect(bloco, `o item de ${rota} está fora do gate de PF`).toContain(`/perfis/\${currentProfileId}/${rota}`)
    }
  })
})

describe('os itens PJ que não têm gate de empresa somem no PF', () => {
  it('Contas a Pagar/Receber e Conciliação ficam atrás de `workspaceType !== pf`', () => {
    const i = src.indexOf("<SectionLabel>Financeiro</SectionLabel>")
    const j = src.indexOf('label="Transferências"')
    const bloco = src.slice(i, j)
    expect(bloco).toMatch(// ⚠️ REGEX AFROUXADO EM 30/08 — e SÓ pra aceitar um gate MAIS restritivo, nunca menos:
    // o bloco virou `workspaceType !== 'pf' && !soEstoque && (` quando o menu passou a
    // respeitar o papel (operadora de estoque não vê financeiro). Exigir o `(` colado
    // fazia o guard reprovar um aperto de segurança — guard que impede endurecer é guard
    // que envelheceu.
    /workspaceType !== 'pf' &&/)
    // e os 4 estão DENTRO desse bloco
    /**
     * ⚠️ "Pendentes" SAIU desta lista na faxina de 15/09 — **não porque afrouxou, porque o
     * item não existe mais**: a tela morreu e virou a CAIXA DE ENTRADA. O guard de quem
     * NÃO pode voltar mora em `regras-ui/rota-morta-nao-volta-pro-menu`; aqui a pergunta
     * continua sendo a do PF (item de empresa não vaza pro workspace pessoal).
     */
    for (const l of ['Contas a Pagar', 'Contas a Receber', 'Conciliação']) {
      expect(bloco).toContain(`label="${l}"`)
    }
  })
})
