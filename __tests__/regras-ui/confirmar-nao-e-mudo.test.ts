// ⛔⛔⛔ O CLIQUE QUE GRAVAVA E NÃO DIZIA NADA (14/09/2026)
//
// **O dono, navegando:** *"abro Vendas → Complementos → dia 13/09 → revisão → clico
// 'Confirmar e baixar' → NADA acontece: nenhum modal de prévia, nenhum recibo, nenhuma
// mudança de contador — a tela fica igual."*
//
// **⛔⛔ E ERA PIOR QUE NADA: o clique GRAVOU.** Medido no ledger — `BAIXA_VENDA` de
// complementos às **19:33:17**, do clique dele. A tela zerava o preview, recarregava a lista
// (que não mudava, porque os nomes já estavam vinculados) e **jogava o recibo fora**.
//
// ⭐⭐ **A RÉGUA QUE FICA:** ***gravar sem dizer é pior que não gravar — porque o dono clica
// de novo.*** Todo botão que escreve no ledger: **modal de prévia antes** e **recibo depois**.
//
// ⚠️⚠️ **E A LIÇÃO SOBRE O GUARD ANTERIOR, que é a que dói:** eu tinha um teste provando que
// `<PlanoVendaModal` existe no fluxo de complementos — e ele passava **verde**, porque eu
// liguei o modal no caminho do UPLOAD e o dono navegou o caminho do DIA. *É o "guard que
// testa a lib e aprova a tela que ignora a lib", em versão nova: **testei o modal, não o
// botão que o abre**.* Este guard pergunta pelo CAMINHO.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios } from './card-nao-nasce-escondido.test'

const raiz = process.cwd()
const REVISAO = 'components/estoque/revisao-do-import.tsx'
const VENDAS = 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx'
const revisao = semComentarios(readFileSync(join(raiz, REVISAO), 'utf-8'))
const vendas = semComentarios(readFileSync(join(raiz, VENDAS), 'utf-8'))

/**
 * ⭐ O DETECTOR: quem CHAMA a função que grava, e de onde.
 *
 * ⚠️ Não basta "o modal existe no arquivo" — foi exatamente essa a pergunta que passou verde
 * com o botão gravando direto. A pergunta é **quem dispara a escrita**.
 */
export function chamadoresDe(src: string, fn: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(new RegExp(`\\b${fn}\\s*\\(`, 'g'))) {
    // 120 caracteres antes bastam pra dizer se veio de um onClick ou de um onConfirmar
    const antes = src.slice(Math.max(0, m.index! - 120), m.index!)
    if (/function\s+$|async function\s+$/.test(antes)) continue // a declaração, não uma chamada
    const onde = /onConfirmar=/.test(antes) ? 'modal'
      : /onClick=/.test(antes) ? 'botão'
        : 'outro'
    out.push(onde)
  }
  return out
}

describe('⛔⛔ nada grava sem o modal de prévia — nos DOIS relatórios', () => {
  /**
   * ⛔ O caminho do DIA (lista → revisar) era o que gravava direto. Agora o botão do rodapé
   * ABRE o modal, e quem grava é o `gravar()`, chamado só de dentro dele.
   */
  it('⭐ o botão do rodapé ABRE o modal, não grava', () => {
    expect(revisao).toContain('onClick={confirmar ? confirmar.acao : abrirModal}')
    expect(revisao).toMatch(/function abrirModal\(\) \{[^}]*setModal\(true\)/)
  })

  it('⛔ a função que GRAVA só é chamada de dentro do modal', () => {
    const de = chamadoresDe(revisao, 'gravar')
    expect(de.length, 'ninguém grava — o botão ficou decorativo?').toBeGreaterThan(0)
    expect([...new Set(de)], 'alguém grava fora do modal de prévia').toEqual(['modal'])
  })

  it('⭐ o modal é o MESMO da tela de produtos', () => {
    expect(revisao).toContain('<PlanoVendaModal')
    expect(revisao).toContain("from './plano-venda-modal'")
  })

  /**
   * ⭐⭐ O CAMINHO, não a peça: o fluxo do DIA (revisão) e o do UPLOAD (complementos) têm,
   * cada um, o seu modal montado. Provar que o componente existe no repo não prova que o
   * botão que o dono aperta chega nele.
   */
  it('⭐ os DOIS caminhos montam o modal — o do dia e o do upload', () => {
    expect(revisao.match(/<PlanoVendaModal/g)?.length ?? 0).toBe(1)
    expect(vendas.match(/<PlanoVendaModal/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

describe('⛔⛔ e a tela RESPONDE depois de gravar', () => {
  it('⭐ o recibo do servidor é GUARDADO e mostrado', () => {
    expect(revisao).toContain('setRecibo(')
    expect(revisao).toContain('baixado:')
  })

  /**
   * ⚠️ O número do recibo vem do SERVIDOR, sempre. Um contador remontado na tela diria um
   * número e o ledger outro — a doença que este módulo mais paga.
   */
  it('⛔ o número vem da resposta, não de uma conta da tela', () => {
    expect(revisao).toMatch(/const rc = r\.data\.recibo/)
  })

  it('⭐ e os contadores recarregam depois de gravar', () => {
    const g = revisao.slice(revisao.indexOf('async function gravar'))
    const corpo = g.slice(0, g.indexOf('\n  }'))
    expect(corpo).toContain('await carregar()')
    expect(corpo).toContain('await verPreview()')
  })
})

describe('⛔ nenhum fetch de prévia ou de gravação fica pendurado', () => {
  it('prévia e gravação passam pelo fetch com teto de tempo', () => {
    const g = revisao.slice(revisao.indexOf('async function gravar'))
    expect(g.slice(0, 900)).toContain('fetchComTimeout')
    const v = revisao.slice(revisao.indexOf('async function verPreview'))
    expect(v.slice(0, 700)).toContain('fetchComTimeout')
  })

  it('⭐ e a gravação tem teto MAIOR que a leitura — desistir de uma escrita é pior', () => {
    const g = revisao.slice(revisao.indexOf('async function gravar'))
    expect(g.slice(0, 1200)).toContain('timeoutMs: 60_000')
  })
})

// ⭐⭐ REGRA 11 — o detector tem que pegar o defeito que motivou o guard.
describe('o detector morde (auto-teste)', () => {
  it('acusa a gravação disparada direto pelo botão (o defeito de 14/09)', () => {
    const DEFEITO = `<button onClick={gravar}>Confirmar</button>`
    expect(chamadoresDe(`<button onClick={() => gravar(true)}>x</button>`, 'gravar')).toEqual(['botão'])
    expect(DEFEITO).toContain('gravar')
  })

  it('aprova a gravação vinda do modal', () => {
    expect(chamadoresDe(`<PlanoVendaModal onConfirmar={(c) => void gravar(c)} />`, 'gravar')).toEqual(['modal'])
  })

  it('não confunde a DECLARAÇÃO com uma chamada', () => {
    expect(chamadoresDe('async function gravar(x: boolean) { return x }', 'gravar')).toEqual([])
  })
})
