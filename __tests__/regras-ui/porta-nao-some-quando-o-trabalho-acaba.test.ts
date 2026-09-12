// ⛔⛔⛔ A PORTA QUE SOME QUANDO O TRABALHO ACABA (12/09/2026) — a 4ª volta da família.
//
// **O dono:** *"existia um lugar pra trocar a seção de um produto do cardápio e ele não
// aparece mais. **Eu uso isso direto**."*
//
// **⛔ MEDIDO EM PROD:** a porta pra `/estoque/cardapio/secoes` renderizava só com
// `hub.linhas.some((l) => l.secaoSugerida)` — e a Caçula tem **166 produtos com 0
// sugeridos**. O link ficou **invisível**. O comentário original dizia *"decisão pronta não
// pede gesto de novo"*, e a intenção era boa: o efeito é que **REVER uma decisão virou
// impossível pela tela**.
//
// ⭐⭐ **A REGRA QUE FICA, e ela é irmã da de 10/09 (card que nasce escondido):**
// *fila zerada esconde o TRABALHO, nunca a FERRAMENTA.* O contador pode sumir; a porta não.
//
// ⚠️ Guard ESTRUTURAL e assumido como tal (sem jsdom não dá pra renderizar), com
// **auto-teste do detector** — senão passaria verde por cegueira.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '..', '..')
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

/**
 * O `href` está dentro de um `&&` cujo lado esquerdo é uma contagem de TRABALHO PENDENTE?
 * ⚠️ Olha o trecho IMEDIATAMENTE antes do link (300 caracteres): é ali que mora o gate.
 */
function portaEscondidaAtras(fonte: string, href: string): boolean {
  const i = fonte.indexOf(href)
  if (i < 0) return false
  const antes = fonte.slice(Math.max(0, i - 300), i)
  // `{algo.some(...) && (` ou `{algo.length > 0 && (` logo antes do link
  return /\)\s*&&\s*\(\s*<a[^>]*$/.test(antes) || /\.some\([^)]*\)\s*&&\s*\(\s*$/.test(antes.replace(/\s*<a[\s\S]*$/, ''))
}

describe('⛔⛔ fila zerada esconde o TRABALHO, nunca a FERRAMENTA', () => {
  const cardapio = ler('app/(dashboard)/empresas/[id]/estoque/cardapio/page.tsx')
  const produto = ler('app/(dashboard)/empresas/[id]/estoque/cardapio/[chave]/page.tsx')

  it('⛔⛔ a porta do LOTE de seções não fica atrás de "tem sugestão pendente"', () => {
    expect(cardapio).toContain('estoque/cardapio/secoes')
    expect(portaEscondidaAtras(cardapio, 'estoque/cardapio/secoes')).toBe(false)
  })

  it('⭐ e ela DIZ o que faz quando não há pendência — "revisar ou remanejar em lote"', () => {
    expect(cardapio).toContain('revisar ou remanejar')
  })

  it('⛔⛔ o PRODUTO individual tem o gesto de trocar a seção — era o que não existia', () => {
    expect(produto).toContain('Seção do cardápio')      // o aria-label do controle
    expect(produto).toContain('cardapio/secoes/lote')   // e usa a MESMA porta do lote
  })

  it('⭐ o produto não inventa uma segunda rota de gravação (REGRA 4)', () => {
    // a rota do lote aceita `min(1)`; criar um endpoint só pro individual seria a segunda
    // porta que esta casa passou setembro inteiro fechando
    const rotas = [...produto.matchAll(/cardapio\/secoes[a-z/]*/g)].map((m) => m[0])
    expect([...new Set(rotas)]).toEqual(['cardapio/secoes/lote'])
  })

  it('⚠️ AUTO-TESTE DO DETECTOR: ele PEGA o padrão que existia antes', () => {
    const antigo = `
      {hub.linhas.some((l) => l.secaoSugerida) && (
        <a href={\`/empresas/\${id}/estoque/cardapio/secoes\`}
          className="...">`
    expect(portaEscondidaAtras(antigo, 'estoque/cardapio/secoes')).toBe(true)
  })

  it('⚠️ e NÃO acusa uma porta que está solta na tela', () => {
    const bom = `<a href={\`/empresas/\${id}/estoque/cardapio/secoes\`} className="...">`
    expect(portaEscondidaAtras(bom, 'estoque/cardapio/secoes')).toBe(false)
  })
})
