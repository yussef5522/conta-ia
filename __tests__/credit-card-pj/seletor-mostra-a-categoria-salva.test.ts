// ⛔⛔ O SELETOR DA LINHA MOSTRA O QUE ESTÁ GRAVADO (17/09/2026)
//
// **O dono:** *"o painel 'Por categoria' mostra os 4 grupos certos, mas TODAS as linhas
// exibem o seletor em '— sem categoria —'. A tela tem que dizer o que o banco já sabe."*
//
// ⚠️⚠️ **HONESTIDADE SOBRE ESTE TESTE: eu NÃO reproduzi o defeito.** Medi as quatro camadas
// e todas estavam certas — payload com `categoryId` em 33/33 (com e sem `?fatura=`), zero id
// fora das opções, a fonte no servidor e **o JS servido** ligando
// `value: W[e.id] ?? e.categoryId ?? ""`. Então este guard **não é a prova de um conserto**:
// é a regra saindo do JSX, onde ninguém consegue testá-la, e virando função.
//
// ⭐ *Regra que mora num `value={...}` é regra que ninguém prova* — a lição do prefill do
// cardápio (28/08), que quebrou duas vezes antes de virar função pura.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { valorDoSeletor } from '@/lib/credit-card-pj/valor-do-seletor'

/** as linhas REAIS da fatura do dono, como o payload as entrega */
const LINHAS = [
  { id: 'tx-ml', categoryId: 'cat-equip' },      // MERCADOLIVRE → EQUIPAMENTOS
  { id: 'tx-netflix', categoryId: 'cat-estorno' }, // NETFLIX → Estornos/Ressarcimentos
  { id: 'tx-anuid', categoryId: 'cat-tarifa' },   // ANUIDADEINT → Tarifas Bancárias
  { id: 'tx-nova', categoryId: null },             // ainda sem categoria
]

describe('⭐⭐ a linha nasce com a categoria SALVA selecionada', () => {
  it('⭐ sem clique nenhum, o seletor vale o que está gravado', () => {
    expect(valorDoSeletor({}, LINHAS[0])).toBe('cat-equip')
    expect(valorDoSeletor({}, LINHAS[1])).toBe('cat-estorno')
    expect(valorDoSeletor({}, LINHAS[2])).toBe('cat-tarifa')
  })

  it('⭐ e linha sem categoria mostra vazio — o "— sem categoria —"', () => {
    expect(valorDoSeletor({}, LINHAS[3])).toBe('')
  })

  /** ⭐ o clique que ainda não voltou do servidor vence — é o que faz o seletor seguir o dedo */
  it('⭐ o otimista vence o gravado enquanto a gravação está no ar', () => {
    expect(valorDoSeletor({ 'tx-ml': 'cat-outra' }, LINHAS[0])).toBe('cat-outra')
  })

  /**
   * ⛔ `??` e NÃO `||`: com `||`, um otimista de string vazia cairia no gravado e a tela
   * voltaria a mostrar a categoria antiga depois de o dono escolher "sem categoria".
   */
  it('⛔ otimista vazio é uma ESCOLHA, não ausência', () => {
    expect(valorDoSeletor({ 'tx-ml': '' }, LINHAS[0])).toBe('')
  })
})

describe('⛔ a tela usa a regra, e não uma cópia dentro do JSX', () => {
  const tela = () =>
    readFileSync(join(process.cwd(), 'app/(dashboard)/empresas/[id]/cartoes/[cardId]/page.tsx'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it('⭐ o `value` do seletor vem de `valorDoSeletor`', () => {
    const t = tela()
    expect(t).toMatch(/value=\{valorDoSeletor\(otimista, t\)\}/)
    expect(
      /value=\{otimista\[t\.id\] \?\? t\.categoryId \?\? ''\}/.test(t),
      'a regra voltou pra dentro do JSX — lá ninguém a testa',
    ).toBe(false)
  })

  /**
   * ⭐⭐ E A TELA NÃO DEPENDE DE UM WIDGET SÓ PRA DIZER A VERDADE. Se o `<select>` falhar em
   * hidratar por qualquer motivo, a linha continua **afirmando em texto** o que está gravado.
   * ⚠️ Isto não conserta um defeito que eu tenha visto — é a tela parando de ter um único
   * ponto de falha pra uma informação que o banco já tem.
   */
  it('⭐ a categoria gravada também é dita em TEXTO', () => {
    expect(tela()).toMatch(/categoria salva:[\s\S]{0,120}t\.categoryName/)
  })
})
