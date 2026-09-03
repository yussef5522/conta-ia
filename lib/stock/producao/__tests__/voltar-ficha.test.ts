// ⛔⛔ DEPOIS DE SALVAR, VOLTA PRA ONDE VOCÊ ESTAVA — e a lista mista não ressuscita.
//
// CASO REAL (03/09): o dono salvou uma ficha de sabor pela prateleira de complementos e caiu
// em `/estoque/fichas`, a lista MISTA (sabor + receita de cozinha + produto). Ele ia repetir
// esse gesto ~50 vezes na mesma tarde. Causa: a página `nova` montava o editor **sem dizer
// de onde o usuário veio**, então o `voltar` caía no default.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { destinoDeVolta, rotulosDaFicha, destinosDaPlaca, ehCaminhoInterno } from '../voltar-ficha'

const EMPRESA = 'cmq17yapb00gnrndlh33sctbo'
const ABA_COMPLEMENTOS = `/empresas/${EMPRESA}/estoque/cardapio?aba=complementos`

describe('⛔⛔ a porta da prateleira', () => {
  it('⛔⛔ salvar ficha de sabor volta pra ABA COMPLEMENTOS, não pra lista de fichas', () => {
    const destino = destinoDeVolta(EMPRESA, { voltar: ABA_COMPLEMENTOS, complemento: 'CALABRESA', tipo: 'SABOR' })
    expect(destino).toBe(ABA_COMPLEMENTOS)
    expect(destino, 'voltou pro lixão que a gente separou').not.toMatch(/\/estoque\/fichas$/)
  })

  it('⛔ SEM o `voltar` explícito o destino muda — é o defeito reposto (REGRA 11)', () => {
    // ⚠️ era exatamente este o estado da página: editor montado sem `voltarPara`
    const semVoltar = destinoDeVolta(EMPRESA, { complemento: null, tipo: 'SABOR' })
    expect(semVoltar).toBe(`/empresas/${EMPRESA}/estoque/fichas`)
    expect(semVoltar).not.toBe(ABA_COMPLEMENTOS)
  })

  it('⭐ rede pra link antigo: veio com `?complemento=` e sem `voltar` → prateleira', () => {
    expect(destinoDeVolta(EMPRESA, { complemento: 'CALABRESA' })).toBe(ABA_COMPLEMENTOS)
  })

  it('⭐ e a volta cai na ABA certa (o `?aba=` é o que faz a linha verde aparecer)', () => {
    expect(destinoDeVolta(EMPRESA, { voltar: ABA_COMPLEMENTOS })).toContain('aba=complementos')
  })
})

describe('⭐ a porta de Vendas', () => {
  it('⭐ "+ criar ficha de produto final" volta pra VENDAS', () => {
    const vendas = `/empresas/${EMPRESA}/estoque/vendas`
    expect(destinoDeVolta(EMPRESA, { voltar: vendas, tipo: 'PRODUTO_FINAL' })).toBe(vendas)
  })
})

describe('⛔ o destino é caminho interno, sempre', () => {
  it('⛔ URL externa é RECUSADA — open redirect de manual', () => {
    expect(ehCaminhoInterno('https://evil.com')).toBe(false)
    expect(ehCaminhoInterno('//evil.com')).toBe(false) // o browser lê como host
    expect(destinoDeVolta(EMPRESA, { voltar: 'https://evil.com' })).toBe(`/empresas/${EMPRESA}/estoque/fichas`)
    expect(destinoDeVolta(EMPRESA, { voltar: '//evil.com' })).toBe(`/empresas/${EMPRESA}/estoque/fichas`)
  })
})

describe('⭐ os rótulos dizem a verdade', () => {
  it('⭐ sabor: "Nova ficha de sabor" + "voltar pra Complementos"', () => {
    expect(rotulosDaFicha({ complemento: 'CALABRESA', tipo: 'SABOR' }))
      .toEqual({ titulo: 'Nova ficha de sabor', voltarTexto: 'voltar pra Complementos' })
  })
  it('⚠️ e NÃO dizem "ficha técnica" pros três mundos, como diziam antes', () => {
    expect(rotulosDaFicha({ tipo: 'PRODUTO_FINAL' }).titulo).toBe('Nova ficha de produto')
    expect(rotulosDaFicha({ tipo: 'INTERMEDIARIO' }).titulo).toBe('Nova ficha técnica')
    expect(rotulosDaFicha({ complemento: 'CALABRESA' }).titulo).not.toBe('Nova ficha técnica')
  })
})

describe('⭐⭐ a PLACA de /estoque/fichas', () => {
  it('⭐ os três destinos existem e apontam pras rotas certas', () => {
    const d = destinosDaPlaca(EMPRESA)
    expect(d.map((x) => x.chave)).toEqual(['cardapio', 'receitas', 'complementos'])
    expect(d.find((x) => x.chave === 'cardapio')!.href).toBe(`/empresas/${EMPRESA}/estoque/cardapio`)
    expect(d.find((x) => x.chave === 'receitas')!.href).toBe(`/empresas/${EMPRESA}/estoque/producao/receitas`)
    expect(d.find((x) => x.chave === 'complementos')!.href).toBe(ABA_COMPLEMENTOS)
    // cada um DIZ o que mora ali — a placa existe pra responder isso
    expect(d.every((x) => x.explica.length > 20)).toBe(true)
  })

  /**
   * ⛔⛔ O TESTE QUE IMPEDE O LIXÃO DE RESSUSCITAR.
   *
   * ⚠️ Estrutural e ASSUMIDO como tal: o projeto roda em `environment: node`, sem jsdom, então
   * não dá pra renderizar a página e contar linhas. O que dá — e é o que importa — é provar
   * que a rota **não busca a lista de fichas**: era o `fetch` dessa API que alimentava a
   * mistura.
   *
   * ⭐ E o detector tem AUTO-TESTE contra o código VELHO (REGRA 11): sem isso ele passaria
   * verde por cegueira, que é como os três guards deste projeto já nasceram mentindo.
   */
  const buscaListaDeFichas = (fonte: string) => /fetch\([^)]*estoque\/fichas['"`]/.test(fonte)

  it('⛔⛔ a placa NÃO busca a lista de fichas (e o detector pega a versão velha)', () => {
    const velha = `useEffect(() => { fetch(\`/api/empresas/\${id}/estoque/fichas\`).then((r) => r.json()).then((j) => setFichas(j.fichas ?? [])) }, [id])`
    expect(buscaListaDeFichas(velha), 'o detector não pega o código que motivou o guard').toBe(true)

    const atual = readFileSync(join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/fichas/page.tsx'), 'utf-8')
    expect(buscaListaDeFichas(atual), 'a lista mista voltou a viver em /estoque/fichas').toBe(false)
    // ⚠️ e ela continua sendo uma PLACA: os três destinos saem da lib, não de um fetch
    expect(atual).toMatch(/destinosDaPlaca/)
  })

  it('⭐ as rotas filhas continuam vivas — só a LISTA morreu', () => {
    for (const f of ['app/(dashboard)/empresas/[id]/estoque/fichas/nova/page.tsx',
      'app/(dashboard)/empresas/[id]/estoque/fichas/[fichaId]/page.tsx']) {
      expect(() => readFileSync(join(process.cwd(), f), 'utf-8'), f).not.toThrow()
    }
  })
})
