// ⛔⛔⛔ O LOTE DE MAIONESE QUE ENTROU MIL VEZES MAIOR (19/09/2026)
//
// **Medido em prod, nas duas conclusões da viviane:**
// ```
// 14/09 CUBA MAIONESE  gerou 22864   · rendimento 2855,50 (a média: 2,85)  · custo un R$ 0,01
// 16/09 MAIONESE       gerou 22864   · rendimento 2858,00 (a média: 2,858) · custo un R$ 0,01
// ```
// ⭐ O fator é **exatamente mil** — a balança mostra GRAMA e o item é controlado em KG.
//
// ⚠️⚠️ **E A DÍVIDA DO PARSE NÃO EXPLICAVA ESTE CASO**, medido antes de escrever o guard:
// `sanitizarQtd('22.864','KG')` → `22,864` e o parse do tablet → `22.864`. Os dois
// caminhos concordam. O que produz 22864 é digitar `22864` sem separador.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { avaliarPlausibilidade, FATOR_PERGUNTA, FATOR_RECUSA } from '@/lib/stock/producao/plausibilidade'
import { sanitizarQtd, valorQtd } from '@/lib/stock/quantidade'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    // ⚠️ comentário de SQL também sai: a linha de ROLLBACK do .sql CONTÉM "DROP TABLE",
    // e sem isto o guard do CREATE-only morderia a própria documentação do rollback.
    .replace(/^\s*--.*$/gm, '')

/**
 * ⭐ quantas vezes o símbolo é USADO — a linha do `import` não conta.
 *
 * ⚠️⚠️ Existe porque DOIS guards meus deste arquivo passaram verdes com o defeito reposto
 * (REGRA 11, 19/09): eu contava a MENÇÃO, e a linha do `import` no topo já bastava. É a
 * quarta vez que esta casa paga por isso — o padrão virou helper, não lembrança.
 */
function usosDe(src: string, simbolo: string): number {
  return src.split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

/** ⭐ a POSIÇÃO do uso (não da menção) — pra provar ordem entre duas chamadas */
function posDoUso(src: string, simbolo: string): number {
  const linhas = src.split('\n')
  let off = 0
  for (const l of linhas) {
    if (!/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l) && l.includes(`${simbolo}(`)) return off
    off += l.length + 1
  }
  return -1
}

const base = { unidade: 'KG', nomeDoProduto: 'CUBA MAIONESE', lotesNaMedia: 3 }

describe('⛔⛔ o caso REAL de 14/09 — 22864 no lugar de 22,864', () => {
  it('⭐ RECUSA e diz o número provável', () => {
    const v = avaliarPlausibilidade({ ...base, qtdGerada: 22864, rendimento: 2855.5, rendimentoMedio: 2.85 })
    expect(v.decisao).toBe('RECUSA')
    expect(v.suspeitaDeGrandeza).toBe('MIL_VEZES')
    expect(v.qtdProvavel).toBe(22.864)
    expect(v.mensagem).toContain('grama lido como KG')
    expect(v.mensagem).toContain('22,864')
  })

  it('⭐ e o número CERTO passa liso', () => {
    expect(avaliarPlausibilidade({ ...base, qtdGerada: 22.864, rendimento: 2.85, rendimentoMedio: 2.85 }).decisao).toBe('OK')
  })

  it('⭐ o de 16/09 (MAIONESE, rendimento 2858 contra 2,858) também', () => {
    const v = avaliarPlausibilidade({ ...base, nomeDoProduto: 'MAIONESE', qtdGerada: 22864, rendimento: 2858, rendimentoMedio: 2.858 })
    expect(v.decisao).toBe('RECUSA')
    expect(v.qtdProvavel).toBe(22.864)
  })
})

describe('⭐ a régua NÃO é ruidosa — alarme falso mata o alarme', () => {
  it('⛔ produção do DOBRO passa: variação não é grandeza', () => {
    expect(avaliarPlausibilidade({ ...base, qtdGerada: 60, rendimento: 6, rendimentoMedio: 3 }).decisao).toBe('OK')
  })

  it('⛔ sem histórico NÃO julga — primeiro lote de uma ficha nunca é alarme', () => {
    expect(avaliarPlausibilidade({ ...base, qtdGerada: 22864, rendimento: 2855, rendimentoMedio: null, lotesNaMedia: 0 }).decisao).toBe('OK')
  })

  it('⛔ com UM lote só na média também não — um lote atípico viraria a régua', () => {
    expect(avaliarPlausibilidade({ ...base, qtdGerada: 22864, rendimento: 2855, rendimentoMedio: 2.85, lotesNaMedia: 1 }).decisao).toBe('OK')
  })

  it('⭐ 10× PERGUNTA, 100× RECUSA — dois degraus, não um', () => {
    expect(FATOR_PERGUNTA).toBe(10)
    expect(FATOR_RECUSA).toBe(100)
    expect(avaliarPlausibilidade({ ...base, qtdGerada: 45, rendimento: 45, rendimentoMedio: 3 }).decisao).toBe('PERGUNTA')
    expect(avaliarPlausibilidade({ ...base, qtdGerada: 450, rendimento: 450, rendimentoMedio: 3 }).decisao).toBe('RECUSA')
  })

  it('⚠️ 50× é grande mas NÃO é grandeza — não sugere número nenhum', () => {
    const v = avaliarPlausibilidade({ ...base, qtdGerada: 150, rendimento: 150, rendimentoMedio: 3 })
    expect(v.suspeitaDeGrandeza).toBeNull()
    expect(v.qtdProvavel).toBeNull()
  })
})

describe('⚠️ a régua de digitação NÃO era a causa — medido', () => {
  it('⭐ "22.864" em KG dá 22,864 nos DOIS caminhos', () => {
    expect(valorQtd(sanitizarQtd('22.864', 'KG'))).toBe(22.864)
    expect(Number('22.864'.replace(',', '.'))).toBe(22.864)
  })

  it('⛔ e "22864" dá 22864 nos dois — é a digitação sem separador que produz o caso', () => {
    expect(valorQtd(sanitizarQtd('22864', 'KG'))).toBe(22864)
    expect(Number('22864'.replace(',', '.'))).toBe(22864)
  })
})

describe('⛔⛔ a pergunta vem ANTES de qualquer escrita', () => {
  it('⭐ a rota do tablet avalia a grandeza antes de finalizar a etapa', () => {
    const r = fonte('app/api/empresas/[id]/estoque/producao/minhas-tarefas/finalizar/route.ts')
    // ⚠️ POSIÇÃO DO USO, nunca do texto: o `import` no topo do arquivo cita os dois
    // símbolos e fazia este guard passar com o bloco movido pro catch (REGRA 11).
    const iAvalia = posDoUso(r, 'avaliarGrandezaDaConclusao')
    const iFinaliza = posDoUso(r, 'finalizarTarefa')
    expect(iAvalia, 'a avaliação sumiu da rota').toBeGreaterThan(-1)
    expect(iAvalia, 'a etapa fecharia antes da pergunta — a cozinha ficaria sem repetir').toBeLessThan(iFinaliza)
  })

  it('⭐ e o motor mantém o guard (cinto e suspensório, mesma composição)', () => {
    expect(fonte('lib/stock/producao/conclusao.ts')).toMatch(/if \(plaus\.decisao !== 'OK' && !input\.confirmouGrandeza\) throw/)
  })
})

describe('⛔⛔ lote estornado NUNCA entra na média', () => {
  it('⭐ a média consulta os estornados e os exclui', () => {
    const c = fonte('lib/stock/producao/conclusao.ts')
    expect(usosDe(c, 'idsDeConclusoesEstornadas'), 'a desintoxicação sumiu — o rendimento podre voltaria a ser "o histórico"').toBeGreaterThan(0)
    expect(c).toMatch(/notIn: fora/)
  })

  it('⭐ estornar duas vezes é impossível por construção (unique no banco)', () => {
    expect(fonte('prisma/schema.prisma')).toMatch(/conclusaoId\s+String\s+@unique/)
    expect(fonte('prisma/migrations/20260919040000_stock_conclusao_estornada/migration.sql'))
      .toMatch(/CREATE UNIQUE INDEX .*conclusaoId/)
  })

  it('⛔ e a migration é CREATE-only (o isolamento do módulo)', () => {
    const m = fonte('prisma/migrations/20260919040000_stock_conclusao_estornada/migration.sql')
    expect(m).not.toMatch(/ALTER TABLE|DROP TABLE/)
    expect(m, 'estorno sem motivo vira mistério em três meses').toMatch(/CHECK \(length\(trim\("motivo"\)\) > 0\)/)
  })
})

describe('⭐ a cozinha vê a unidade e o número em um toque', () => {
  it('⭐ o campo DIZ em que unidade o sistema conta', () => {
    expect(fonte('app/cozinha/[empresaId]/page.tsx')).toMatch(/em \{fechando\.unidadeProduto\}/)
  })

  it('⭐ o aviso oferece o número provável', () => {
    const t = fonte('app/cozinha/[empresaId]/page.tsx')
    expect(t).toMatch(/usar \{String\(grandeza\.qtdProvavel\)/)
    expect(t, 'sem o escape a recusa vira beco').toMatch(/é isso mesmo, pode fechar/)
  })

  it('⭐ e o tipo da tarefa vem da LIB, não é copiado à mão', () => {
    const t = fonte('app/cozinha/[empresaId]/page.tsx')
    expect(t).toMatch(/type Tarefa = MinhaTarefa/)
    expect(t).toMatch(/import type \{ MinhaTarefa \}/)
  })
})

describe('⚠️⚠️ o PREVIEW fala a mesma língua da POSIÇÃO', () => {
  it('⛔ o saldo do preview vem de saldosDaEmpresa, nunca do aggregate cru', () => {
    const e = fonte('lib/stock/producao/estorna-e-relanca.ts')
    expect(usosDe(e, 'saldosDaEmpresa'), 'o preview voltou a somar tudo').toBeGreaterThan(0)
    // ⚠️ bug meu pego ANTES do OK do dono: o aggregate cru inclui PRODUCAO_CONSUMO, que é
    // transferência interna e não conta na prateleira — dava 3,12 onde a Posição diz 36,494
    expect(e, 'aggregate cru de quantidade é outra pergunta').not.toMatch(/stockMovement\.aggregate\([\s\S]{0,140}_sum: \{ quantidade: true \}/)
  })
})
