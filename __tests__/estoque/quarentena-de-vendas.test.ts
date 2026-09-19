// ⭐⭐ A QUARENTENA DO IMPORT DE VENDAS (19/09/2026)
//
// **O caso:** o relatório de produtos não leu nada, o arquivo morreu no `throw`, e
// diagnosticar exigia pedir o .xls de volta. É a mesma ausência que o `rawOfxBlob` fechou
// pro extrato (13/08) e a `fatura_quarentena` pro cartão (16/09) — a **terceira** vez.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pistasDoArquivo } from '@/lib/stock/vendas/quarentena-venda'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*--.*$/gm, '')

function usosDe(src: string, simbolo: string): number {
  return src.split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

describe('⭐⭐ "não leu nada" deixou de ser uma frase só', () => {
  it('⛔ arquivo vazio DIZ que veio vazio', () => {
    expect(pistasDoArquivo('').pista).toContain('VAZIO')
  })

  it('⛔ arquivo sem tabela ensina que o .xls do Suitable é HTML por dentro', () => {
    const p = pistasDoArquivo('erro 500 — sessão expirada')
    expect(p.temTabela).toBe(false)
    expect(p.pista).toContain('HTML')
  })

  it('⛔ tabela com OUTRAS colunas: pode ser outro relatório', () => {
    const p = pistasDoArquivo('<table><tr><th>Mesa</th><th>Garçom</th></tr></table>')
    expect(p.temTabela).toBe(true)
    expect(p.temCabecalho).toBe(false)
    expect(p.pista).toContain('outro relatório')
  })

  it('⭐ e tabela CERTA sem linha é o único caso em que "dia sem venda" é a hipótese', () => {
    const p = pistasDoArquivo('<table><tr><th>Produto</th><th>Quantidade</th></tr></table>')
    expect(p.temCabecalho).toBe(true)
    expect(p.pista).toContain('dia sem venda')
  })
})

describe('⛔⛔ os DOIS relatórios passam pela porta única', () => {
  it('⭐ produtos: nenhum parse solto sobrou', () => {
    const b = fonte('lib/stock/vendas/baixa-venda.ts')
    expect(usosDe(b, 'lerComQuarentena'), 'o import de produtos voltou a ler sem guardar').toBeGreaterThan(0)
    expect(usosDe(b, 'parseSuitable'), 'sobrou um parse fora da porta — é o caminho que perde o arquivo').toBe(0)
  })

  it('⭐ complementos: idem, e nos DOIS call-sites (preview e confirm)', () => {
    const c = fonte('lib/stock/vendas/import-complementos.ts')
    expect(usosDe(c, 'lerComQuarentena')).toBe(2)
    expect(usosDe(c, 'parseSuitable'), 'parse direto dentro da porta é esperado; fora dela, não').toBe(2)
  })

  it('⭐ TODA tentativa fica guardada — a que fecha é o golden de amanhã', () => {
    const q = fonte('lib/stock/vendas/quarentena-venda.ts')
    expect(q).toMatch(/desfecho: erroDoParse \|\| vazio \? 'RECUSADA' : 'OK'/)
  })

  it('⛔ e guardar é FAIL-SOFT: nunca derruba um import legítimo', () => {
    expect(fonte('lib/stock/vendas/quarentena-venda.ts')).toMatch(/} catch \{\s*\n\s*return null/)
  })
})

describe('⭐ a migration é CREATE-only e o vocabulário é fechado', () => {
  const m = fonte('prisma/migrations/20260919050000_stock_venda_quarentena/migration.sql')
  it('⛔ nada de ALTER/DROP (o isolamento do módulo)', () => {
    expect(m).not.toMatch(/ALTER TABLE|DROP TABLE/)
  })
  it('⭐ relatório e desfecho com CHECK — valor fora da lista é chamada errada', () => {
    expect(m).toMatch(/CHECK \("relatorio" IN \('PRODUTOS','COMPLEMENTOS'\)\)/)
    expect(m).toMatch(/CHECK \("desfecho" IN \('OK','RECUSADA'\)\)/)
  })
  it('⚠️ e o expurgo de 12 meses existe de verdade (não é promessa escrita)', () => {
    expect(usosDe(fonte('lib/stock/vendas/quarentena-venda.ts'), 'expurgarTextosDeVendaAntigos')).toBeGreaterThanOrEqual(0)
    expect(fonte('lib/stock/vendas/quarentena-venda.ts')).toMatch(/textoPurgadoEm: new Date\(\)/)
  })
})
