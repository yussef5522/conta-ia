/**
 * ⭐⭐⭐ O RECEBIMENTO ACHA O ITEM — inclusive o negativo (23/09/2026).
 *
 * **O caso:** chegou nota do ALAN com SAL e a conferência não achava o `sal` pra casar —
 * *"só criando produto novo"*, o que criaria um segundo item do que já existe.
 *
 * ⚠️⚠️ A hipótese do dono (*"filtra saldo negativo?"*) **caiu na medição**. Não havia filtro
 * de saldo nenhum. As causas, medidas em prod, foram duas e nenhuma era a suspeita:
 *   1. `take: 300` com **348 ativos** → o `sal` (minúsculo, fim da ordem) não chegava;
 *   2. e o motivo de haver 348: **o universo nunca foi declarado**, então 189 invólucros de
 *      cardápio (PRODUTO_FINAL + SABOR + INTERMEDIARIO) comiam as vagas do que se compra.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { filtrarPorBusca } from '@/lib/busca-texto'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('⛔⛔ o teto de leitura não pode esconder item — 3ª vez nesta casa', () => {
  const ROTAS = [
    'app/api/empresas/[id]/estoque/recebimentos/[nfeId]/route.ts',
    'app/api/empresas/[id]/estoque/recebimentos/preview/route.ts',
  ]

  it('⭐⭐ as DUAS rotas passam pelo MESMO dono da pergunta (REGRA 4)', () => {
    for (const r of ROTAS) {
      const src = semComentario(ler(r))
      expect(src, `${r} voltou a montar a lista na mão`).toContain('itensParaCasarNoRecebimento')
      // ⛔ e a listagem própria morreu — enquanto ela existir, o teto volta por descuido
      expect(src, `${r} tem um findMany de stockItem de novo`).not.toMatch(/stockItem\.findMany/)
    }
  })

  it('⛔⛔ o universo é DECLARADO — sem ele o cardápio come as vagas da compra', () => {
    const lib = semComentario(ler('lib/stock/itens-do-recebimento.ts'))
    expect(lib).toContain("categoriasDoUniverso('COMPRAVEL')")
  })

  it('⛔⛔⛔ e NADA filtra por saldo — negativo é quem MAIS precisa aparecer', () => {
    /**
     * ⭐ A régua do dono: *"a entrada é o conserto"*. O saldo VIAJA (pra a linha avisar),
     * mas nunca entra num `where`.
     */
    const lib = semComentario(ler('lib/stock/itens-do-recebimento.ts'))
    const where = lib.slice(lib.indexOf('where: { companyId'), lib.indexOf('orderBy'))
    expect(where, 'o recebimento passou a esconder item por saldo').not.toMatch(/saldo|quantidade|gt:|gte:/)
    // ⭐ e o saldo é devolvido, pra a tela AVISAR
    expect(lib).toContain('saldo: porItem.get(i.id)')
  })
})

describe('⛔⛔ a busca da conferência é a da CASA, não uma segunda régua', () => {
  it('⭐⭐ o acento deixa de esconder o item (medido em prod)', () => {
    const itens = [{ nome: 'FEIJAO PRETO CALDO DE OURO TP1 1K' }, { nome: 'FEIJAO' }, { nome: 'sal' }]
    // ⛔ a régua antiga (`nome.toLowerCase().includes(busca.toLowerCase())`) achava ZERO
    const velha = itens.filter((e) => e.nome.toLowerCase().includes('feijão'.toLowerCase()))
    expect(velha, 'o contrafactual parou de reproduzir o defeito').toHaveLength(0)
    expect(filtrarPorBusca(itens, 'feijão', (e) => e.nome), 'o dono escreve "feijão", a nota escreve "FEIJAO"').toHaveLength(2)
  })

  it('⭐ e ela casa palavra em qualquer ordem — o nome vem da NOTA', () => {
    const itens = [{ nome: 'PAO DE XIS' }]
    expect(filtrarPorBusca(itens, 'xis pao', (e) => e.nome)).toHaveLength(1)
  })

  it('⛔ a tela não pode voltar a ter régua própria', () => {
    const tela = semComentario(ler('components/estoque/conferencia-view.tsx'))
    expect(tela, 'a busca da conferência virou uma 2ª implementação de novo')
      .not.toMatch(/nome\.toLowerCase\(\)\.includes/)
    expect(tela).toContain('filtrarPorBusca(existentes, busca')
  })

  it('⭐⭐ e o item NEGATIVO aparece com o aviso na linha dele', () => {
    const tela = semComentario(ler('components/estoque/conferencia-view.tsx'))
    expect(tela, 'o aviso do negativo sumiu da lista de casar').toContain('saiu mais do que entrou · esta nota conserta')
    // ⛔ e o vazio DIZ o recorte, senão o dono conclui que o produto não existe
    expect(tela).toContain('itens que se COMPRAM')
  })
})
