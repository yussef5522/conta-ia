// Sprint Ponte-Detalhe-2Col (07/07/2026) — blindagens estáticas.
//
// Cobre APENAS o layout novo em 2 colunas + o painel Resumo:
//   (a) Container max-w-6xl + hero full-width
//   (b) Grid lg:grid-cols-[1fr_340px] com timeline card na esquerda
//   (c) ResumoPanel na direita (% + barra Framer + gasto/na-conta + sócio)
//   (d) Rodapé abaixo do grid (excluir link discreto, criado em)
//   (e) Responsivo: mobile empilha (grid-cols default 1)
//
// NÃO cobre lógica (fluxo A/B, segurança, microinteração — coberto na sprint
// anterior HEAD 6e28050).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Container max-w-6xl + hero preserve full-width', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('main usa max-w-6xl (antes era max-w-2xl)', () => {
    expect(code).toMatch(/<main\s+className="mx-auto\s+max-w-6xl/)
    // Não deve mais aparecer max-w-2xl no main principal (só no not-found)
    const mainCount = (code.match(/<main\s+className="[^"]*max-w-2xl/g) ?? []).length
    // Not-found continua max-w-2xl (compacto pra empty state) — no máximo 1 ocorrência
    expect(mainCount).toBeLessThanOrEqual(1)
  })

  it('padding lateral confortável (px-4 mobile, px-8 sm, px-12 lg)', () => {
    expect(code).toMatch(
      /<main\s+className="[^"]*px-4[^"]*sm:px-8[^"]*lg:px-12/,
    )
  })

  it('HERO continua com gradiente e valor grande (não regrediu)', () => {
    expect(code).toMatch(
      /bg-gradient-to-br\s+from-\[#1E3A8A\][\s\S]{0,120}to-\[#0F4A8C\]/,
    )
    expect(code).toMatch(/text-4xl[\s\S]{0,120}tabular-nums[\s\S]{0,120}sm:text-5xl/)
  })
})

describe('b) Grid 2 colunas + timeline num Card à esquerda', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('grid lg:grid-cols-[1fr_340px] com gap-6', () => {
    expect(code).toMatch(
      /<div\s+className="grid\s+gap-6\s+lg:grid-cols-\[1fr_340px\]/,
    )
  })

  it('timeline envolvida em Card com título "A jornada do dinheiro"', () => {
    // O título fica dentro do Card da coluna esquerda
    expect(code).toMatch(/A jornada do dinheiro/)
    // TimelineNode segue dentro do <section aria-label="Linha do tempo..."
    expect(code).toMatch(
      /<Card[\s\S]{0,600}A jornada do dinheiro[\s\S]{0,600}<TimelineNode/,
    )
  })

  it('notas (bridge.notes) movidas pro rodapé do card jornada', () => {
    // Notas dentro do Card da esquerda (depois do <section>)
    expect(code).toMatch(
      /data\.bridge\.notes[\s\S]{0,600}Observações[\s\S]{0,300}<\/Card>/,
    )
  })

  it('3 TimelineNode continuam renderizados (nada removido)', () => {
    const matches = code.match(/<TimelineNode\s/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBe(3)
  })
})

describe('c) ResumoPanel na coluna direita', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('componente ResumoPanel definido', () => {
    expect(code).toMatch(/function\s+ResumoPanel\(/)
  })

  it('recebe pctUsado/gasto/naConta/total/hasSpend/socioPF', () => {
    const props = code.match(/interface\s+ResumoPanelProps\s*\{[\s\S]+?\}/)
    expect(props).toBeTruthy()
    expect(props![0]).toMatch(/pctUsado:\s*number/)
    expect(props![0]).toMatch(/gasto:\s*number/)
    expect(props![0]).toMatch(/naConta:\s*number/)
    expect(props![0]).toMatch(/hasSpend:\s*boolean/)
  })

  it('cálculo % + gasto + naConta reusa data existente (sem query nova)', () => {
    // Deriva do hasSpend + data.spendTransaction.amount (nada de fetch extra)
    expect(code).toMatch(
      /gasto\s*=\s*hasSpend[\s\S]{0,120}data\.spendTransaction\.amount/,
    )
    expect(code).toMatch(/pctUsado\s*=[\s\S]{0,120}gasto\s*\/\s*total/)
    expect(code).toMatch(/naConta\s*=\s*Math\.max\(0,\s*total\s*-\s*gasto/)
  })

  it('% grande em tabular-nums; verde quando completo', () => {
    // Verde se isComplete, senão slate
    expect(code).toMatch(/text-4xl\s+font-semibold\s+tabular-nums/)
    expect(code).toMatch(/isComplete\s*\?\s*['"]text-emerald-600['"]/)
  })

  it('barra de progresso animada com Framer (motion.div preenche da esquerda)', () => {
    expect(code).toMatch(
      /<motion\.div[\s\S]{0,240}initial=\{\s*\{\s*width:\s*0\s*\}[\s\S]{0,120}animate=\{\s*\{\s*width:\s*`\$\{pctUsado\}%`/,
    )
  })

  it('barra troca cor conforme estado (emerald 100%, amber parcial/0%)', () => {
    expect(code).toMatch(/isComplete\s*\?\s*['"]bg-emerald-500['"]\s*:\s*['"]bg-amber-400['"]/)
  })

  it('legenda "Gasto" + "Na conta" com valores em tabular-nums', () => {
    expect(code).toMatch(/>Gasto<\/p>[\s\S]{0,240}tabular-nums[\s\S]{0,80}formatBRL\(gasto\)/)
    expect(code).toMatch(/>Na conta<\/p>[\s\S]{0,240}tabular-nums[\s\S]{0,80}formatBRL\(naConta\)/)
  })

  it('sócio compacto com CPF mascarado dentro do ResumoPanel', () => {
    // Não usa regex de bloco (destructuring termina em `}` cedo);
    // confirma que o ResumoPanel referencia socioPF.cpf via maskCpf.
    expect(code).toMatch(/function\s+ResumoPanel/)
    expect(code).toMatch(/socioPF:\s*BridgeDetailFull\[['"]socioPF['"]\]/)
    expect(code).toMatch(/maskCpf\(socioPF\.cpf\)/)
    expect(code).toMatch(/Sócio rastreado/)
  })

  it('accessibility: barra tem role=progressbar + aria-valuenow', () => {
    expect(code).toMatch(/role="progressbar"/)
    expect(code).toMatch(/aria-valuenow=\{pctRounded\}/)
  })
})

describe('d) Rodapé abaixo do grid (excluir link + criado em)', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('excluir continua como <button> link discreto', () => {
    expect(code).toMatch(
      /text-slate-400[\s\S]{0,240}hover:text-rose-600[\s\S]{0,240}Excluir esta ponte/,
    )
  })

  it('NÃO usa variant="destructive" na tela (só no modal)', () => {
    expect(code).not.toMatch(/variant="destructive"[\s\S]{0,240}Excluir/)
  })

  it('BridgeDeleteModal continua reusado', () => {
    expect(code).toMatch(/<BridgeDeleteModal[\s\S]{0,400}onConfirm=\{handleDelete\}/)
  })
})

describe('e) Coluna direita sticky no desktop (opcional)', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('wrapper da coluna direita usa lg:sticky + lg:top-6', () => {
    expect(code).toMatch(/lg:sticky\s+lg:top-6/)
  })
})

describe('f) Skeleton adapta pro layout 2 col', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('skeleton usa max-w-6xl e grid lg 2 col', () => {
    // Bloco `if (loading)` no início do render
    const skeletonBlock = code.match(
      /if\s*\(\s*loading\s*\)\s*\{[\s\S]+?<\/main>\s*\)/,
    )
    expect(skeletonBlock).toBeTruthy()
    expect(skeletonBlock![0]).toMatch(/max-w-6xl/)
    expect(skeletonBlock![0]).toMatch(/lg:grid-cols-\[1fr_340px\]/)
  })
})
