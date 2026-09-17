// ⛔⛔⛔ O SELETOR RENDERIZADO MOSTRA A CATEGORIA SALVA (17/09/2026)
//
// **O dono, depois que o texto dedurou o widget:** *"TODAS as 33 linhas mostram 'categoria
// salva: <certa>' e o `<select>` AO LADO continua em '— sem categoria —'. Não basta o value
// bater — a option tem que existir."*
//
// ⭐ Ele separou as duas coisas, e o guard segue a separação: aqui a fatura é **renderizada
// de verdade** (`renderToStaticMarkup`, sem jsdom) e a afirmação é sobre o MARKUP — a option
// **selecionada** tem que existir e carregar o NOME da categoria. Grep no fonte não distingue
// "o value está escrito no JSX" de "a option existe pra ele".
//
// ⚠️ As linhas são as da fatura REAL do Carter banrisul (as 4 categorias e as contagens que
// prod tem): 15 EQUIPAMENTOS · 12 Estornos/Ressarcimentos · 3 Tarifas · 3 Mercado.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { valorDoSeletor, opcoesDoSeletor } from '@/lib/credit-card-pj/valor-do-seletor'

const CATS = [
  { id: 'cat-equip', name: 'EQUIPAMENTOS' },
  { id: 'cat-estorno', name: 'Estornos/Ressarcimentos' },
  { id: 'cat-tarifa', name: 'Tarifas Bancárias' },
  { id: 'cat-mercado', name: 'Mercado/Alimentação' },
]

interface LinhaDaFatura { id: string; categoryId: string | null; categoryName: string | null }

/** as 33 linhas da fatura real, na proporção que prod tem */
const LINHAS: LinhaDaFatura[] = [
  ...Array.from({ length: 15 }, (_, i) => ({ id: `ml-${i}`, categoryId: 'cat-equip', categoryName: 'EQUIPAMENTOS' })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `es-${i}`, categoryId: 'cat-estorno', categoryName: 'Estornos/Ressarcimentos' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `tb-${i}`, categoryId: 'cat-tarifa', categoryName: 'Tarifas Bancárias' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `mk-${i}`, categoryId: 'cat-mercado', categoryName: 'Mercado/Alimentação' })),
]

/** ⭐ o MESMO desenho da tela: value pela regra, options pela regra */
function Seletor({ lista, linha }: { lista: typeof CATS; linha: LinhaDaFatura }) {
  return (
    <select key={`cat-${linha.id}-${valorDoSeletor({}, linha)}`} value={valorDoSeletor({}, linha)} onChange={() => {}}>
      <option value="">— sem categoria —</option>
      {opcoesDoSeletor(lista, linha).map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}

/** o texto da `<option>` marcada como selecionada no markup */
function opcaoSelecionada(html: string): string | null {
  const m = html.match(/<option[^>]*selected[^>]*>([^<]*)<\/option>/)
  return m ? m[1] : null
}

describe('⭐⭐ cada linha da fatura renderiza a categoria dela SELECIONADA', () => {
  it('⭐ as 33 linhas: a option selecionada existe e tem o nome certo', () => {
    for (const linha of LINHAS) {
      const html = renderToStaticMarkup(<Seletor lista={CATS} linha={linha} />)
      expect(
        opcaoSelecionada(html),
        `${linha.id}: o seletor não marcou a categoria salva — é o "— sem categoria —" do dono`,
      ).toBe(linha.categoryName)
    }
  })

  it('⭐ linha SEM categoria continua mostrando "— sem categoria —"', () => {
    const html = renderToStaticMarkup(
      <Seletor lista={CATS} linha={{ id: 'nova', categoryId: null, categoryName: null }} />,
    )
    expect(opcaoSelecionada(html)).toBe('— sem categoria —')
  })
})

describe('⛔⛔ e a option SOBREVIVE a uma lista que não tem o id', () => {
  /**
   * ⛔ **O cenário que o dono nomeou:** *"as options vêm de uma lista cujos value não são o
   * MESMO id que a linha carrega"*. Medido no caso dele as listas TINHAM os ids — então isto
   * não é o conserto de um descasamento que eu vi; é a garantia de que o widget não depende
   * de a lista estar completa. **Value sem option é um select que não mostra nada.**
   */
  it('⭐ lista de OUTRA fonte (sem o id) → a categoria salva entra como option assim mesmo', () => {
    const outraFonte = [{ id: 'xxx-1', name: 'Outra' }, { id: 'xxx-2', name: 'Coisa' }]
    const linha = LINHAS[0]
    const html = renderToStaticMarkup(<Seletor lista={outraFonte} linha={linha} />)
    expect(opcaoSelecionada(html)).toBe('EQUIPAMENTOS')
  })

  it('⭐ lista VAZIA → idem', () => {
    const html = renderToStaticMarkup(<Seletor lista={[]} linha={LINHAS[15]} />)
    expect(opcaoSelecionada(html)).toBe('Estornos/Ressarcimentos')
  })

  it('⛔ e não duplica a option quando a lista já tem o id', () => {
    const r = opcoesDoSeletor(CATS, LINHAS[0])
    expect(r.filter((c) => c.id === 'cat-equip')).toHaveLength(1)
    expect(r).toHaveLength(CATS.length)
  })
})
