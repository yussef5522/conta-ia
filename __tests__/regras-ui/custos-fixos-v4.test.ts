/**
 * ⭐⭐ O GUARD DA TELA DE CUSTOS FIXOS (06/10/2026) — ESTRUTURAL, e assumido como tal.
 *
 * ⚠️ O projeto roda em `environment: node` (sem jsdom), então não dá pra renderizar e clicar.
 * O que este guard trava é o que o dono pediu e o que já voltou nesta casa: a tela não pode
 * recalcular dinheiro, não pode montar bloco de aviso inline, o selo não pode nascer aqui, e
 * o "a apurar" não pode virar R$ 0,00.
 *
 * ⛔⛔ **ELE LÊ A FONTE SEM COMENTÁRIO, de propósito.** O arquivo documenta no próprio texto os
 * defeitos que ele mata (*"a tela não calcula nada de dinheiro"*, *"nada de bloco de aviso
 * inline"*) — lendo o texto cru, **o arquivo que documenta o defeito seria o que o absolve**.
 * É a "menção, não uso" que já mordeu 8 vezes aqui.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const TELA = 'app/(dashboard)/empresas/[id]/custos-fixos/page.tsx'
const LEITURA = 'lib/custos-fixos/leitura.ts'
const SIDEBAR = 'components/sidebar/global-sidebar.tsx'

const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
const semComentarios = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/** ⚠️ conta o USO, nunca a MENÇÃO: import e comentário não valem (a lição do `hrefSemPagamento`) */
function usosDe(src: string, nome: string): number {
  const limpo = semComentarios(src).split('\n').filter((l) => !/^\s*import\b/.test(l)).join('\n')
  return (limpo.match(new RegExp(`\\b${nome}\\b`, 'g')) ?? []).length
}

describe('⛔⛔ a tela NÃO calcula dinheiro — ela desenha o que o servidor aceitou', () => {
  const src = semComentarios(ler(TELA))

  it('⭐ os 3 cartões leem o payload, não uma conta local', () => {
    expect(src).toContain('dados.casaCustaMes')
    expect(src).toContain('dados.porDiaAberto.valor')
    expect(src).toContain('dados.pontoDeEquilibrio.porDia')
  })

  it('⛔ nenhuma divisão de dinheiro na tela — margem e por-dia saem da lib', () => {
    // ⚠️ o que mordeu em outras telas foi a tela fazendo a conta "pra ficar mais simples"
    expect(src).not.toMatch(/casaCustaMes\s*\/\s*/)
    expect(src).not.toMatch(/\/\s*(margem|margemPct|dados\.margem)/)
    expect(src).not.toMatch(/custoFixoDiario/)
  })

  it('⭐ o SELO vem do servidor (`situacao.texto`/`situacao.tom`) — a tela só pinta', () => {
    expect(src).toContain('linha.situacao.texto')
    expect(src).toContain('TOM[linha.situacao.tom]')
    // ⛔ e ela NÃO decide o estado: nenhuma comparação de vencimento aqui
    expect(src).not.toContain('statusDaConta')
    expect(src).not.toMatch(/dueDate/)
  })

  it('⭐ o total do rodapé é o do payload, nunca um `reduce` local de dinheiro', () => {
    expect(src).toContain('dados.totalPlanejado')
    expect(src).toContain('dados.totalRealizado')
    expect(src).toContain('dados.pctPago')
    // ⛔ nenhum `reduce` somando realizado/planejado na tela
    expect(src).not.toMatch(/reduce\([^)]*realizado/)
    expect(src).not.toMatch(/reduce\([^)]*planejado/)
  })
})

describe('⛔⛔ "a apurar" NUNCA vira R$ 0,00', () => {
  const src = semComentarios(ler(TELA))

  it('⭐ o cartão testa `== null` antes de formatar — e diz "a apurar"', () => {
    expect(src).toMatch(/valor == null \?/)
    expect(src).toContain('a apurar')
  })

  it('⭐ "% pago" sem plano também é "a apurar", não 0%', () => {
    const rodape = src.slice(src.indexOf('% pago'))
    const atePonto = rodape.slice(0, rodape.indexOf('</span>'))
    expect(atePonto).toContain('pctPago == null')
    expect(atePonto, 'sem plano não existe percentual — dividir por nada daria 0%').toContain("'a apurar'")
  })

  it('⭐ Σ planejado idem', () => {
    const i = src.indexOf('Σ planejado')
    const bloco = src.slice(i, i + 400)
    expect(bloco).toContain('totalPlanejado == null')
    expect(bloco).toContain("'a apurar'")
  })
})

describe('⛔⛔ NADA de bloco de aviso inline (lei de 04/10)', () => {
  const src = semComentarios(ler(TELA))

  it('a tela não monta o bloco de avisos nem fala com a central', () => {
    expect(src).not.toContain('BlocoDeAvisos')
    expect(src).not.toContain('/api/avisos')
    expect(src).not.toContain('registrarAviso')
  })

  it('⭐ e o AVISO existe — no produtor do sininho, setor financeiro', () => {
    // ⚠️ guard que só afirma a ausência aprovaria o dia em que o aviso sumisse de todo lugar
    const prod = ler('lib/avisos/produtores/financeiro.ts')
    expect(prod).toContain("setor: 'financeiro'")
    expect(usosDe(prod, 'registrarAviso')).toBeGreaterThan(0)
    expect(usosDe(prod, 'reconciliarOrigem')).toBeGreaterThan(0)
    // ⛔ e ele NÃO recalcula o par plano×realizado: lê a MESMA função que a tela desenha
    expect(usosDe(prod, 'lerCustosFixos')).toBeGreaterThan(0)
    expect(prod).not.toContain('whereFluxoCaixa')
  })
})

describe('⭐ o realizado tem uma PORTA só', () => {
  const src = semComentarios(ler(LEITURA))

  it('⛔ a leitura do realizado passa pelo `whereFluxoCaixa` — nunca um where próprio', () => {
    expect(usosDe(src, 'whereFluxoCaixa')).toBeGreaterThan(0)
    // ⚠️ o groupBy do realizado não pode montar o recorte na mão
    const i = src.indexOf('groupBy')
    const bloco = src.slice(i, i + 400)
    expect(bloco).toContain('whereFluxoCaixa')
  })

  it('⛔ nenhuma coluna de realizado no schema — decisão se grava, fato se deriva', () => {
    const schema = ler('prisma/schema.prisma')
    const modelo = schema.slice(schema.indexOf('model CustoFixoPlanejado'))
    const corpo = modelo.slice(0, modelo.indexOf('}'))
    expect(corpo).not.toMatch(/realizado/i)
    expect(corpo).toContain('valor')
  })

  it('⭐ o selo reusa o dono de "vencida/vence hoje" do Contas a Pagar (REGRA 4)', () => {
    const sit = ler('lib/custos-fixos/situacao.ts')
    expect(sit).toContain("from '@/lib/contas-pagar/escopo'")
    expect(usosDe(sit, 'statusDaConta')).toBeGreaterThan(0)
    // ⛔ e NÃO existe comparação de data própria aqui
    expect(semComentarios(sit)).not.toMatch(/new Date\(\)\s*[<>]/)
    expect(semComentarios(sit)).not.toContain('inicioDoDiaBrasil(')
  })
})

describe('⭐ a roupa é v4: token, dois temas, zero hex', () => {
  const src = ler(TELA)

  it('⛔ nenhuma cor cravada em hex', () => {
    const hex = semComentarios(src).match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(hex, `cor cravada: ${hex.join(', ')}`).toEqual([])
  })

  it('⭐ os cartões de dono usam o fundo e a tinta da FAMÍLIA', () => {
    expect(src).toContain('var(--fam-${familia}-bg)')
    expect(src).toContain('var(--fam-${familia}-ink)')
  })

  it('⛔ nenhuma opacidade sobre valor arbitrário — no Tailwind 3 isso sai TRANSPARENTE', () => {
    // ⚠️ a armadilha de 05/10: `bg-[var(--x)]/70` não gera cor nenhuma
    expect(semComentarios(src)).not.toMatch(/\[var\(--[^)]+\)\]\/\d/)
  })

  it('⭐ a sublinha dos cartões é SERIFADA EM ITÁLICO (o padrão v4 do dono)', () => {
    expect(src).toContain('font-serif')
    expect(src).toContain('italic')
  })
})

describe('⭐ o menu e a porta guardada', () => {
  const side = semComentarios(ler(SIDEBAR))

  it('⭐ "Custos fixos" ocupou o lugar de "Recorrentes"', () => {
    expect(side).toContain('label="Custos fixos"')
    expect(side).toContain('custos-fixos')
    expect(side, 'o item do menu saiu').not.toContain('label="Recorrentes"')
  })

  it('⛔ a CAPACIDADE do Recorrentes não morreu — a tela ainda tem porta', () => {
    // ⚠️ remoção sem realocação é perda (10/09): o motor roda, e o link vive no pé da tela
    expect(semComentarios(ler(TELA))).toContain('/recorrentes')
  })
})

describe('⭐ a tela diz o que não alcança', () => {
  const src = semComentarios(ler(TELA))

  it('⚠️ a lacuna do CARTÃO de crédito aparece quando existe compra no mês', () => {
    expect(src).toContain('dados.comprasNoCartao')
    expect(src).toContain('pagamento de fatura')
  })

  it('⭐ o navegador de mês é o da casa, com a frase OBRIGATÓRIA do recorte', () => {
    expect(src).toContain('<NavegadorDeMes')
    expect(src).toMatch(/frase="[^"]+"/)
  })

  it('⛔ o estado de falha tem NOME e tem botão — spinner eterno não existe', () => {
    expect(src).toContain("'FALHOU'")
    expect(src).toContain('tentar de novo')
    expect(src).toContain('fetchComTimeout')
  })
})
