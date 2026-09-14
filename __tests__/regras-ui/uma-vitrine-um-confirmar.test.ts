// ⛔⛔⛔ A TELA VELHA NÃO MORREU QUANDO A NOVA NASCEU — NAS DUAS (14/09/2026)
//
// **O dono:** *"depois do confirmar (e no upload), a página empilha: recibo + REVISÃO nova
// + o RELATÓRIO/TABELA VELHA (produtos: 'Mapeamento (115)' com trocar/desmapear e SEGUNDO
// botão de confirmar; complementos: o relatório feio antigo que não edita nada). O mesmo
// dado em duas vitrines, dois confirmares — **é a segunda derivação em forma de página**."*
//
// ⭐⭐ **A REGRA QUE FICA, e vale pras próximas:** *quando a tela nova assume, a velha MORRE
// NO MESMO DEPLOY.* Conviver "por enquanto" é como nasce a página com duas verdades — a
// mesma doença dos 7 detectores de par, agora em HTML.
//
// ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL (sem jsdom não dá pra renderizar). Com auto-teste dos
// detectores (REGRA 11), senão passaria verde por cegueira.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios } from './card-nao-nasce-escondido.test'
import { corpoDaFuncao } from './revisao-do-import-tem-macaneta.test'

const raiz = process.cwd()
const VENDAS = 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx'
const REVISAO = 'components/estoque/revisao-do-import.tsx'
const vendas = semComentarios(readFileSync(join(raiz, VENDAS), 'utf-8'))
const revisao = semComentarios(readFileSync(join(raiz, REVISAO), 'utf-8'))

/**
 * ⭐ Quantas vezes a fonte desenha uma LISTA de nomes do dia?
 *
 * ⚠️ O sinal é o `.map(` sobre uma coleção de linhas do relatório. Duas listas = duas
 * vitrines do mesmo dado — foi exatamente o que o dono viu empilhado.
 */
export function listasDeNomesDoDia(src: string): string[] {
  const alvos = ['prateleira.map(', 'linhasFiltradas.map(', 'preview.linhas.map(', 'linhas.map(']
  return alvos.filter((a) => src.includes(a))
}

/** ⭐ os botões que GRAVAM o dia (importar/baixar/reprocessar) */
export function botoesQueGravamODia(src: string): string[] {
  return [...src.matchAll(/<button[\s\S]{0,600}?<\/button>/g)]
    .map((m) => m[0])
    .filter((b) => /Confirmar (baixa|e baixar|import)|Confirmar e baixar|Lançar /.test(b))
}

describe('⛔⛔ UMA VITRINE — cada nome do dia aparece uma vez só', () => {
  /**
   * ⛔ A TABELA VELHA DE PRODUTOS MORREU. Ela tinha checkbox, chip de destino e
   * trocar/desmapear — tudo que a revisão já faz, com busca e contadores por cima.
   */
  it('a tela de produtos não desenha mais a tabela "Mapeamento (N)"', () => {
    expect(vendas).not.toContain('Mapeamento (')
    expect(vendas).not.toContain('só pendentes (')
  })

  it('⛔ o "relatório feio" de complementos (a prateleira pós-upload) morreu', () => {
    expect(vendas).not.toContain('prateleira.map(')
    expect(vendas).not.toContain('Complemento</th>')
  })

  it('⭐ a página não tem NENHUMA lista de nomes do dia — quem lista é a revisão', () => {
    expect(listasDeNomesDoDia(vendas), 'voltou uma segunda vitrine na página').toEqual([])
    expect(revisao).toContain('visiveis.map(')
  })

  /**
   * ⛔⛔ E O PREVIEW MORRE NO CONFIRMAR: sem isso a página fica com a lista do ARQUIVO e a
   * lista do DIA ao mesmo tempo — as duas vitrines de novo, agora por dentro.
   */
  it('⭐ depois de confirmar sobra UMA verdade: o dia gravado', () => {
    const corpo = corpoDaFuncao(vendas, 'VendasImportPage')
    const conf = corpo.slice(corpo.indexOf('const confirmar ='))
    expect(conf.slice(0, conf.indexOf('const sp =')), 'o preview sobreviveu ao confirmar')
      .toContain('setPrevRevisao(null)')
  })
})

describe('⛔⛔ UM CONFIRMAR por página', () => {
  it('a tela de produtos não tem botão próprio de confirmar baixa', () => {
    const corpo = corpoDaFuncao(vendas, 'VendasImportPage')
    expect(botoesQueGravamODia(corpo), 'voltou um segundo confirmar na página').toEqual([])
  })

  it('a tela de complementos também não — quem confirma é o rodapé da revisão', () => {
    const corpo = corpoDaFuncao(vendas, 'ImportComplementos')
    expect(botoesQueGravamODia(corpo)).toEqual([])
  })

  /**
   * ⭐ O confirmar é DELEGADO: antes do import quem grava é a tela (import + baixa num
   * gesto, a régua de 07/09); depois, quem grava é a revisão (reprocessar). Um botão, dois
   * donos — dois botões seriam dois confirmares pro mesmo dado.
   */
  it('⭐ o rodapé da revisão aceita o confirmar de quem a hospeda', () => {
    expect(revisao).toContain('confirmar.acao')
    expect(revisao).toContain('confirmar.rotulo')
  })

  it('⭐ e os dois relatórios usam o MESMO modal de prévia', () => {
    // ⛔ o resumo inline dos complementos era um SEGUNDO desenho de "o que acontece se eu
    // confirmar?" — dois desenhos da mesma pergunta divergem no primeiro campo novo.
    const comp = corpoDaFuncao(vendas, 'ImportComplementos')
    expect(comp).toContain('<PlanoVendaModal')
    expect(vendas.match(/<PlanoVendaModal/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

describe('⛔ MUDANÇA DE CASA — nada some sem ter onde morar', () => {
  /**
   * ⭐ A régua do dono: *"o que a tabela velha oferecia EXISTE na revisão antes da velha
   * morrer (remoção sem realocação = perda)"*. É a mesma disciplina da conferência de saldo
   * que mudou de casa em 10/09 — o guard prova os DOIS lados.
   */
  it('desmapear existe na revisão (vinha da tabela velha)', () => {
    expect(revisao).toContain("alvoTipo: 'DESMAPEAR'")
  })

  it('⭐ IGNORAR passou a existir nos DOIS relatórios', () => {
    // ⛔ antes era só complementos, e o de produtos deixava o dono sem saída: decisão
    // tomada voltava a pedir decisão em todo import.
    expect(revisao).toContain("alvoTipo: 'IGNORAR'")
    expect(revisao).not.toMatch(/relatorio === 'COMPLEMENTOS' && l\.estado !== 'IGNORADO'/)
  })

  it('o destino e o que ele desconta continuam à vista na linha', () => {
    expect(revisao).toContain('l.destinoNome')
    expect(revisao).toContain('baixa:')
  })
})

// ⭐⭐ REGRA 11 — os detectores têm que pegar o defeito que motivou o guard.
describe('os detectores mordem (auto-teste)', () => {
  it('acusa a segunda vitrine', () => {
    expect(listasDeNomesDoDia('{prateleira.map((l) => <tr/>)}')).toEqual(['prateleira.map('])
    expect(listasDeNomesDoDia('{fichas.map((f) => <li/>)}')).toEqual([])
  })

  it('acusa o segundo confirmar', () => {
    const b = `<button onClick={x}>Confirmar baixa de 3 produtos</button>`
    expect(botoesQueGravamODia(b)).toHaveLength(1)
  })

  it('não confunde botão que não grava o dia', () => {
    expect(botoesQueGravamODia('<button>fechar</button>')).toEqual([])
    expect(botoesQueGravamODia('<button>revisar</button>')).toEqual([])
  })
})
