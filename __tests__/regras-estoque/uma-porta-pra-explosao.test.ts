/**
 * ⛔⛔⛔ UMA PORTA PRA EXPLOSÃO — dose × quantidade acontece num lugar só (02/10/2026).
 *
 * **A ordem do dono:** *"nenhuma multiplicação de receita fora da porta — grep em CI, dose
 * multiplicada fora da porta = vermelho."*
 *
 * ⭐ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL: o que morde de verdade — *a conta está
 * certa?* — vive em `lib/stock/__tests__/explodir-receita.test.ts` e nos goldens da produção
 * e da venda. O que falta provar AQUI é que **ninguém abriu uma segunda porta** — foi a cópia
 * que fez a maionese sair com escala dupla e o Combo baixar bebida duas vezes.
 *
 * ⚠️ A LISTA É DE EXCEÇÕES NOMEADAS, não de proibições gerais: multiplicar dose por CUSTO
 * (dinheiro) e por FATOR DE UNIDADE (reunitizar) são outras perguntas. O que tem dono único é
 * **dose × quantidade produzida/vendida = CONSUMO**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { explodirReceita } from '@/lib/stock/explodir-receita'
import { insumoDoPedido } from '@/lib/stock/producao/escala-da-ordem'

const raiz = process.cwd()

/** ⚠️ sem comentário: o arquivo que DOCUMENTA a regra não pode ser o que a viola */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** a forma do defeito: dose multiplicada por algo (ou algo multiplicado por dose) */
const MULTIPLICA_DOSE =
  /(qtdPlanejada|porLote)\s*\*|\*\s*[A-Za-z_.[\]]*\b(qtdPlanejada|porLote)\b/

/**
 * ⭐ AS EXCEÇÕES, cada uma com o motivo escrito — e nenhuma delas é CONSUMO.
 */
const PERMITIDOS: Record<string, string> = {
  // ⭐ A PORTA. É aqui que dose × quantidade acontece.
  'lib/stock/explodir-receita.ts': 'a porta única',

  // ⚠️ FATOR DE UNIDADE, não quantidade produzida: trocar o controle do item de CX pra UN
  // converte as doses das fichas junto (o caso do pão, 11/09). Outra pergunta.
  'lib/stock/reunitizar-item.ts': 'multiplica pelo FATOR DE CONVERSÃO de unidade',

  // ⚠️ DINHEIRO: dose × custo médio = custo de UM lote. Não sai nada do estoque.
  'lib/stock/producao/custo-teorico.ts': 'dose × CUSTO (dinheiro, não consumo)',
  'lib/stock/producao/fichas.ts': 'dose × CUSTO pro subtotal da linha da ficha',

  // ⚠️ A CONVERSÃO "quero N" → separação, pergunta INVERSA (quantas unidades → quanto pegar).
  // Não grava nada, e está AMARRADA à porta pelo teste do fim deste arquivo.
  //
  // ⭐⭐ ANTES ERA `previsao-rendimento.ts`, e a troca é o sprint de 03/10: aquele arquivo
  // multiplicava dose **pelo rendimento MEDIDO** (`insumoParaSaida`), e o dono tirou a medição
  // da conta da separação (*"receita é lei, rendimento é só relatório"*). A multiplicação
  // mudou de casa pra um arquivo cujo tipo **não aceita rendimento** — e o
  // `previsao-rendimento.ts` saiu desta lista porque deixou de multiplicar dose.
  'lib/stock/producao/escala-da-ordem.ts': 'pedido → separação pela FICHA, amarrado à porta por teste',
}

function arquivosTs(dir: string, fora: string[] = []): string[] {
  const out: string[] = []
  for (const nome of readdirSync(join(raiz, dir))) {
    const rel = `${dir}/${nome}`
    if (nome === 'node_modules' || nome === '__tests__' || nome.startsWith('.')) continue
    const full = join(raiz, rel)
    if (statSync(full).isDirectory()) out.push(...arquivosTs(rel, fora))
    else if (/\.tsx?$/.test(nome) && !fora.includes(rel)) out.push(rel)
  }
  return out
}

describe('⛔⛔⛔ dose × quantidade acontece SÓ na porta', () => {
  it('nenhum arquivo fora da lista multiplica dose de ficha', () => {
    const suspeitos: string[] = []
    for (const rel of [...arquivosTs('lib/stock'), ...arquivosTs('app'), ...arquivosTs('components')]) {
      if (PERMITIDOS[rel]) continue
      const src = semComentario(readFileSync(join(raiz, rel), 'utf-8'))
      if (MULTIPLICA_DOSE.test(src)) {
        const linha = src.split('\n').findIndex((l) => MULTIPLICA_DOSE.test(l)) + 1
        suspeitos.push(`${rel}:${linha}`)
      }
    }
    expect(
      suspeitos,
      `multiplicação de dose fora da porta única.\n` +
        `Use explodirReceita() (lib/stock/explodir-receita.ts) — ou, se for CUSTO/UNIDADE/` +
        `PREVISÃO, declare em PERMITIDOS com o motivo escrito:\n  ${suspeitos.join('\n  ')}`,
    ).toEqual([])
  })

  it('⭐ AUTO-TESTE DO DETECTOR — ele reconhece as formas que já apareceram nesta casa', () => {
    // REGRA 11: guard que não pega o defeito que o motivou dá selo verde de graça.
    expect(MULTIPLICA_DOSE.test('qtdPlanejada: round6(c.qtdPlanejada * ordem.escalaReceitas)')).toBe(true)
    expect(MULTIPLICA_DOSE.test('acc.set(c.itemId, qtd * c.qtdPlanejada)')).toBe(true)
    expect(MULTIPLICA_DOSE.test('const q = escala * porLote')).toBe(true)
    expect(MULTIPLICA_DOSE.test('round4(escala * l.porLote)')).toBe(true)
    // ⚠️ e NÃO morde quem só LÊ a dose (a maioria das telas)
    expect(MULTIPLICA_DOSE.test('<td>{c.qtdPlanejada}</td>')).toBe(false)
    expect(MULTIPLICA_DOSE.test('const { qtdPlanejada } = c')).toBe(false)
  })

  it('⚠️ as exceções declaradas EXISTEM de verdade (lista não envelhece calada)', () => {
    for (const rel of Object.keys(PERMITIDOS)) {
      const src = semComentario(readFileSync(join(raiz, rel), 'utf-8'))
      expect(MULTIPLICA_DOSE.test(src), `${rel} está em PERMITIDOS e já não multiplica dose — tire da lista`).toBe(true)
    }
  })
})

describe('⭐⭐ a CONVERSÃO DO PEDIDO concorda com a PORTA (a amarra que vale mais que a proibição)', () => {
  it('insumoDoPedido == explodirReceita pra a mesma escala', () => {
    /**
     * ⚠️ A conversão não foi proibida de multiplicar — ela foi AMARRADA. Se a régua da porta
     * mudar e a conversão ficar pra trás, este teste fica vermelho — que é exatamente o
     * estrago que a tela produziria: o dono separa por um número e a ordem planeja outro.
     */
    const POR_LOTE = 0.135 // a porção de queijo real
    const alvo = 200

    const previsto = insumoDoPedido({ pedido: alvo, loteBase: 1 }, POR_LOTE)!
    // a MESMA escala que a previsão usou, pela porta
    const escala = previsto / POR_LOTE
    const pelaPorta = explodirReceita(
      { fichaId: 'f' },
      escala,
      {
        componentesByFicha: new Map([[
          'f',
          [{ itemId: 'i-queijo', qtdPlanejada: POR_LOTE }],
        ]]),
        fichaByItemProduzido: new Map(),
      },
      'SEPARACAO',
    )
    expect(pelaPorta.consumos[0].qtd).toBeCloseTo(previsto, 6)
  })
})
