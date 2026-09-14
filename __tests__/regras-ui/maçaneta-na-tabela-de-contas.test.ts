// ⭐⭐⭐ A MAÇANETA TEM QUE APARECER NA TABELA (13/09/2026) — a 7ª volta da família.
//
// **O dono:** *"nenhuma linha tem 'procurar no extrato' à vista (a porta de 10/09 existe
// mas não aparece aqui)"*. Ele estava certo: o deep-link nasceu **dentro do menu ⋮**, que
// é o mesmo que não existir — a lição de 30/08 (*"ação escondida sem afordância não
// existe, principalmente no celular, que é onde o dono opera"*).
//
// ⚠️ **É GUARD ESTRUTURAL, e assumido como tal**: o projeto roda em `environment: node`
// (sem jsdom), então não dá pra clicar. Ele trava o que quebrou de fato — o gesto voltar
// pra dentro do menu, ou o link virar decorativo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TABELA = join(__dirname, '..', '..', 'components', 'contas-pagar', 'PayableTable.tsx')
const fonte = readFileSync(TABELA, 'utf8')

/** o corpo da célula de ações, sem o bloco do DropdownMenuContent (o menu ⋮) */
function foraDoMenu(src: string): string {
  const i = src.indexOf('<DropdownMenuContent')
  const j = src.indexOf('</DropdownMenuContent>')
  return i < 0 || j < 0 ? src : src.slice(0, i) + src.slice(j)
}

describe('⛔⛔ "procurar no extrato" não vive escondido no menu ⋮', () => {
  it('⭐⭐ o link está FORA do DropdownMenuContent — à vista na linha', () => {
    expect(foraDoMenu(fonte), 'o gesto voltou pra dentro do menu de 3 pontinhos')
      .toContain('/conciliacao?conta=')
  })

  it('⭐ e é um LINK de verdade, não um botão decorativo', () => {
    // ⚠️ guard que só olhasse o texto aprovaria um botão apontando pro nada — o mesmo
    // defeito de cabeça pra baixo (a lição do gesto-existe-na-tela-pf, 13/09)
    const trecho = foraDoMenu(fonte)
    expect(trecho).toMatch(/<a href=\{`\/conciliacao\?conta=\$\{row\.original\.id\}`\}/)
  })

  it('⭐⭐ aparece em VENCIDA e em PAGA — e paga aqui é sempre SEM VÍNCULO', () => {
    // a conciliada sai desta tela pela decisão de 28/05, então toda paga que sobra é
    // paga-sem-vínculo: exatamente o estado que o dono precisa investigar
    expect(fonte).toContain("const procurarNoExtrato = visual === 'overdue' || isPaid")
  })

  it('⛔ o rótulo acessível diz de QUAL conta — leitor de tela não vê ícone', () => {
    expect(foraDoMenu(fonte)).toContain('aria-label={`Procurar no extrato:')
  })

  it('⚠️ auto-teste do detector: ele PEGA o mundo de ontem', () => {
    // sem isto o guard passaria por cegueira — a lição dos guards que nasceram verdes
    const ontem = `
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={\`/conciliacao?conta=\${row.original.id}\`}>Procurar no extrato…</a>
        </DropdownMenuItem>
      </DropdownMenuContent>`
    expect(foraDoMenu(ontem)).not.toContain('/conciliacao?conta=')
  })
})
