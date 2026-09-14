// ⭐⭐⭐ "R$ R$ 1.234,56" — O CIFRÃO DUPLICADO MORRE COMO CLASSE (13/09/2026).
//
// **O dono, na tabela de aging:** *"e ela mostra 'R$ R$' duplicado (defeito de formatação
// por cima)"*. Medido: **13 ocorrências em 7 arquivos**, não uma.
//
// ⚠️ A causa é sempre a mesma: `formatBRL`/`brl` usam `Intl` com `style:'currency'`, então
// **já trazem o "R$"** — escrever `R$ {formatBRL(v)}` imprime o cifrão duas vezes. O
// arquivo `totals-bar.tsx` já documentava o bug desde a travessia, e ele nasceu de novo
// em 6 telas: **comentário não é guard.**

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..', '..')
const PASTAS = ['app', 'components']
/** ⚠️ o padrão exato: um "R$" literal COLADO numa chamada que já formata moeda */
const DUPLICADO = /R\$\s*\{\s*(formatBRL|brl|formatMoney|formatCurrency)\s*\(/

function varrer(dir: string, achados: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { varrer(p, achados); continue }
    if (!/\.(tsx|ts)$/.test(e)) continue
    /**
     * ⚠️⚠️ OS COMENTÁRIOS SAEM ANTES, E EM BLOCO — a REGRA 11 me pegou aqui.
     *
     * A 1ª versão limpava comentário LINHA A LINHA, e o `StickyFooter` documenta o bug num
     * `{/* … *␘/}` que atravessa DUAS linhas: o guard acusou a própria explicação do
     * defeito. **Guard que morde a documentação do defeito é guard que alguém apaga** —
     * a mesma lição do guard do mock, que ignorava comentários de propósito.
     */
    const src = readFileSync(p, 'utf8')
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, '')
    src.split('\n').forEach((linha, i) => {
      if (DUPLICADO.test(linha)) achados.push(`${p.slice(RAIZ.length + 1)}:${i + 1}`)
    })
  }
  return achados
}

describe('⛔ "R$" nunca se escreve na mão ao lado de quem já formata moeda', () => {
  it('⭐⭐ zero ocorrências em app/ e components/', () => {
    const achados = PASTAS.flatMap((d) => varrer(join(RAIZ, d)))
    expect(achados, `cifrão duplicado em:\n${achados.join('\n')}`).toEqual([])
  })

  it('⚠️ auto-teste do detector: ele PEGA o padrão e IGNORA o comentário', () => {
    // sem isto o guard passaria por cegueira — a lição dos guards que nasceram verdes
    expect(DUPLICADO.test('<span>R$ {formatBRL(v)}</span>')).toBe(true)
    expect(DUPLICADO.test('  R$ {brl(total)}')).toBe(true)
    // e o que é legítimo não morde
    expect(DUPLICADO.test('<span>{formatBRL(v)}</span>')).toBe(false)
    expect(DUPLICADO.test('const rotulo = `R$ ${v.toFixed(2)}`')).toBe(false)
  })
})
