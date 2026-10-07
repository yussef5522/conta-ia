/**
 * ⭐⭐⭐ AS 3 PRATELEIRAS LIGÁVEIS NA TELA — guard ESTRUTURAL (07/10/2026).
 *
 * ⚠️ **ASSUMIDO COMO ESTRUTURAL:** o projeto roda em `environment: node`, sem jsdom — não dá
 * pra clicar no chip e medir o DOM. Então o guard lê a FONTE e trava o que quebrou de fato,
 * **sem comentário** (o arquivo documenta os defeitos que ele mata; lendo o texto cru, *o
 * arquivo que documenta o defeito seria o que o absolve* — a 10ª "menção, não uso").
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
/**
 * ⛔⛔ O DETECTOR VEM DE UM LUGAR SÓ. A cópia local dele era CEGA a import MULTILINHA e deu
 * **verde com a tela fazendo conta própria** (REGRA 11, 07/10) — duas cópias do mesmo detector
 * divergem, e foi assim que esta passou.
 */
import { semComentarios, usosDe } from './_leitura-de-fonte'

const R = (p: string) => join(process.cwd(), p)
const TELA = R('app/(dashboard)/empresas/[id]/custos-fixos/page.tsx')
const LIB = R('lib/custos-fixos/prateleira.ts')
const LEITURA = R('lib/custos-fixos/leitura.ts')
const COMPROMISSOS = R('lib/custos-fixos/compromissos.ts')
const ROTA = R('app/api/empresas/[id]/custos-fixos/route.ts')

const ler = (p: string) => readFileSync(p, 'utf8')

describe('⭐⭐ OS 3 INTERRUPTORES EXISTEM E RECALCULAM AO VIVO', () => {
  const tela = semComentarios(ler(TELA))

  it('⭐ os 3 chips estão na tela, com estado acessível', () => {
    expect(tela).toContain('🏠 casa')
    expect(tela).toContain('🏦 banco')
    expect(tela).toContain('📅 compromissos')
    expect(tela, 'chip sem aria-pressed é chip que leitor de tela não sabe ler').toContain('aria-pressed={on}')
  })

  /**
   * ⚠️⚠️ **ESTE TESTE VEIO VERDE COM O DEFEITO REPOSTO (REGRA 11, 07/10) e foi APERTADO.**
   *
   * A versão anterior só contava o USO de `cartoesDoTopo` — e o `usosDe` local era cego a
   * import multilinha, então a MENÇÃO no import bastava. Repus a aritmética própria na tela
   * (somando `subtotais` com `?? 0` e dividindo pelos dias) e os 168 testes passaram.
   *
   * ⭐ Agora a régua é ESTRUTURAL: **o corpo do `useMemo` dos cartões não pode ter conta
   * nenhuma** — nem `+`, nem `/`, nem o `?? 0` que transforma "a apurar" em zero. Ele chama a
   * lib e devolve. É assim que os 8 estados dos chips ficam sendo 8 leituras da mesma régua.
   */
  it('⛔⛔ o toggle recalcula LOCAL — e pela MESMA função pura, sem UMA conta na tela', () => {
    expect(usosDe(tela, 'cartoesDoTopo'), 'a régua única dos 4 cartões').toBeGreaterThan(0)
    expect(usosDe(tela, 'alternarChip')).toBeGreaterThan(1)

    const i = tela.indexOf('const cartoes = useMemo')
    expect(i).toBeGreaterThan(-1)
    const corpo = tela.slice(i, tela.indexOf('}, [dados, chips])', i))
    expect(corpo, 'a lib é quem soma').toContain('cartoesDoTopo(')
    expect(corpo, 'soma de dinheiro na tela é a 2ª régua').not.toContain('+')
    expect(corpo, 'divisão de dinheiro na tela idem').not.toMatch(/\/\s/)
    expect(corpo, '`?? 0` num subtotal transforma "a apurar" em zero').not.toContain('?? 0')
  })

  it('⛔ a tela NÃO espera o servidor pra pintar o toggle', () => {
    /**
     * O `alternarChip` muda o estado local e dispara o POST **sem** `await` que bloqueie a
     * pintura: esperar a rede num gesto VISUAL daria lag num clique que o dono usa pra
     * comparar cenário.
     */
    const i = tela.indexOf('const alternarChip')
    expect(i).toBeGreaterThan(-1)
    const bloco = tela.slice(i, tela.indexOf('}, [dados, id, mes])', i))
    expect(bloco).toContain('setChips(')
    expect(bloco, 'persiste em segundo plano').toContain("acao: 'CHIPS'")
    expect(bloco, 'nada de recarregar a tela inteira no toggle').not.toContain('carregar(')
  })

  it('⚠️ o payload semeia os chips UMA vez — recarregar o mês não desfaz o toggle do dono', () => {
    expect(tela).toContain('setChips((c) => c ?? r.data!.chips)')
  })

  it('⚠️ prateleira VAZIA mantém o chip, só marcada "(vazia)"', () => {
    expect(tela).toContain('(vazia)')
    expect(tela).toContain('temBanco')
    expect(tela).toContain('temCompromissos')
  })
})

describe('⭐⭐ O 4º CARTÃO É FIXO — não obedece aos chips', () => {
  const tela = semComentarios(ler(TELA))
  const lib = semComentarios(ler(LIB))

  it('⭐ ele está na tela, coral, com a sublinha que o dono ditou', () => {
    expect(tela).toContain('Pra não afundar')
    expect(tela).toContain('familia="coral"')
    expect(tela, 'o pedido é coral-ESCURO').toContain('escuro')
    expect(tela).toContain('cobre casa, banco e dívida; acima disso começa a sobrar de verdade')
  })

  it('⛔⛔ a LIB ignora os chips no 4º cartão — `CHIPS_PADRAO` cravado, nunca o estado', () => {
    const i = lib.indexOf('export function praNaoAfundar')
    expect(i).toBeGreaterThan(-1)
    const corpo = lib.slice(i, lib.indexOf('\n}', lib.indexOf('return {', i)))
    expect(corpo, 'a verdade completa, sempre').toContain('contaDosCartoes(CHIPS_PADRAO, s)')
  })

  it('⛔ a TELA não passa os chips pro 4º cartão por outro caminho', () => {
    const i = tela.indexOf('titulo="Pra não afundar"')
    const bloco = tela.slice(Math.max(0, i - 400), i + 400)
    expect(bloco).toContain('cartoes!.afundar.porDia')
    expect(bloco).not.toContain('chips')
  })

  it('⛔ o cartão escuro pinta por TOKEN — hex cravado ficaria ilegível no tema escuro', () => {
    const i = tela.indexOf('function CartaoDeDono')
    const corpo = tela.slice(i, tela.indexOf('\n}\n', i))
    expect(corpo).toContain('var(--prod-acao-ink)')
    expect(corpo).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})

describe('⭐⭐ UMA LISTA, DUAS PRATELEIRAS — um componente só', () => {
  const tela = semComentarios(ler(TELA))

  it('⛔⛔ `SecaoDaPrateleira` é usada DUAS vezes (casa e banco), nunca duplicada', () => {
    expect((tela.match(/<SecaoDaPrateleira/g) ?? []).length).toBe(2)
    expect((tela.match(/function SecaoDaPrateleira/g) ?? []).length).toBe(1)
    expect(tela).toContain('🏠 A casa')
    expect(tela).toContain('🏦 O banco')
  })

  it('⛔ `LinhaDaTela` continua UMA — as duas prateleiras desenham a mesma linha', () => {
    expect((tela.match(/function LinhaDaTela/g) ?? []).length).toBe(1)
  })

  it('⚠️ prateleira DESLIGADA não desaparece — fica apagada, dizendo que está fora', () => {
    expect(tela).toContain('fora da conta dos cartões')
    expect(tela).toContain('opacity: ligada ? 1 : 0.6')
  })

  it('⭐ o subtotal de cada seção sai do payload — nunca um reduce de dinheiro aqui', () => {
    const i = tela.indexOf('function SecaoDaPrateleira')
    const corpo = tela.slice(i, tela.indexOf('function SecaoDeCompromissos'))
    expect(corpo).toContain('prateleira.planejado')
    expect(corpo).not.toMatch(/reduce\(/)
  })
})

describe('⭐⭐ 📅 COMPROMISSOS — a prateleira que não é custo', () => {
  const tela = semComentarios(ler(TELA))

  it('⭐ a seção existe, com os dois subgrupos que o dono nomeou', () => {
    expect(tela).toContain('📅 Compromissos do mês')
    expect(tela).toContain('não são custo — é caixa que certamente sai')
    expect(tela).toContain('parcelas de empréstimo (')
    expect(tela).toContain('faturas de cartão (')
  })

  it('⭐ clicar na parcela abre O CONTRATO e na fatura abre O CARTÃO (a fonte)', () => {
    expect(semComentarios(ler(COMPROMISSOS))).toContain('/emprestimos/${l.id}')
    expect(semComentarios(ler(COMPROMISSOS))).toContain('/cartoes/${c.id}')
    const i = tela.indexOf('function LinhaDeParcelaNaTela')
    expect(tela.slice(i, i + 1600)).toContain('href={p.href}')
    const j = tela.indexOf('function LinhaDeFaturaNaTela')
    expect(tela.slice(j, j + 1800)).toContain('href={f.href}')
  })

  it('⛔⛔ "a apurar" NUNCA vira R$ 0,00 — nem na parcela nem na fatura', () => {
    const i = tela.indexOf('function LinhaDeParcelaNaTela')
    expect(tela.slice(i, i + 2000)).toContain("p.valor == null ? 'a apurar'")
    const j = tela.indexOf('function LinhaDeFaturaNaTela')
    expect(tela.slice(j, j + 2200)).toContain("f.net == null ? 'a apurar'")
  })

  it('⚠️ o que ficou FORA da Σ é contado E explicado na tela', () => {
    expect(tela).toContain('c.foraDaSoma.n')
    expect(tela).toContain('c.foraDaSoma.porque')
  })

  it('⭐ a 1 linha do juro-no-banco só aparece quando a CONDIÇÃO é verdadeira', () => {
    expect(tela).toContain('{c.jurosJaNoBanco && (')
  })
})

describe('⛔⛔ O VOCABULÁRIO DAS PRATELEIRAS NÃO MORA NO BANCO (lição de 21/09)', () => {
  const sql = readFileSync(
    R('prisma/migrations/20261007120000_custos_fixos_v2/migration.sql'),
    'utf8',
  )
  /** ⚠️ SQL lido SEM comentário: o arquivo explica o defeito que ele evita */
  const limpo = sql.replace(/^\s*--[^\n]*$/gm, '')

  it('⛔ o CHECK da prateleira valida FORMA, nunca a lista de palavras', () => {
    expect(limpo).toContain('chk_custo_fixo_prateleira_forma')
    expect(limpo, 'CHECK com vocabulário fechado virou parede em UM dia em 21/09')
      .not.toMatch(/prateleira"?\s+IN\s*\(/i)
  })

  it('⛔⛔ REGRA 13 — o CHECK do rastro põe `IS NOT NULL` EXPLÍCITO antes do conteúdo', () => {
    const i = limpo.indexOf('chk_custo_fixo_prateleira_rastro')
    expect(i).toBeGreaterThan(-1)
    const bloco = limpo.slice(i, limpo.indexOf(';', i))
    // `length(trim(NULL))` é NULL, e NULL contamina o AND → o CHECK vira NULL → PASSA
    expect(bloco).toContain('IS NOT NULL')
    expect(bloco).toContain('IS NULL')
  })

  it('⭐ a migration é aditiva: nenhum DROP de coluna/tabela com dado', () => {
    expect(limpo).not.toMatch(/DROP\s+(TABLE|COLUMN)/i)
  })

  it('⭐ o vocabulário vive no TypeScript, onde se acrescenta uma linha', () => {
    expect(semComentarios(ler(LIB))).toContain("export const PRATELEIRAS = ['CASA', 'BANCO'] as const")
  })
})

describe('⛔⛔ UMA PORTA SÓ — marcar, mover e tirar caem no MESMO POST', () => {
  const rota = semComentarios(ler(ROTA))
  const tela = semComentarios(ler(TELA))

  it('⛔⛔ o enum da prateleira DERIVA de `PRATELEIRAS` — nunca digitado na rota', () => {
    /**
     * Repetir a lista à mão deixou DOIS gestos mortos por dias em 25/09 (`z.enum` da rota ×
     * `TODAS_AS_ACOES` da lib): prateleira nova no TS e esquecida aqui vira 400 mudo.
     */
    expect(rota).toContain('z.enum(PRATELEIRAS)')
    expect(rota).not.toMatch(/z\.enum\(\[\s*'CASA'/)
  })

  it('⭐ mover de prateleira é o MESMO `MARCAR` — não existe 2ª porta de gravação', () => {
    expect(rota).not.toContain("literal('MOVER')")
    const i = tela.indexOf('aoMover={(l, p)')
    expect(i).toBeGreaterThan(-1)
    expect(tela.slice(i, i + 160)).toContain("acao: 'MARCAR'")
  })

  it('⭐ a gravação da prateleira passa por `marcarComoFixa`, a porta única', () => {
    expect(usosDe(semComentarios(ler('lib/custos-fixos/gestos.ts')), 'prateleiraDefinidaPorId'))
      .toBeGreaterThan(0)
    expect(rota).toContain('body.prateleira')
  })

  it('⚠️ o rastro da prateleira só nasce quando ela foi ESCOLHIDA (o CHECK exige os dois ou nenhum)', () => {
    const g = semComentarios(ler('lib/custos-fixos/gestos.ts'))
    const i = g.indexOf('const rastro = prateleira')
    expect(i).toBeGreaterThan(-1)
    expect(g.slice(i, i + 220)).toContain(': {}')
  })
})

describe('⛔⛔ O GUARD DE DUPLA CONTAGEM COMPÕE, nunca espalha por cima', () => {
  const leitura = semComentarios(ler(LEITURA))

  it('⛔⛔ o realizado usa `AND: [whereFluxoCaixa(...), SEM_DUPLA_CONTAGEM]`', () => {
    /**
     * O `whereFluxoCaixa` TEM um `NOT` no topo; `{...where, NOT: {...}}` o APAGARIA em
     * silêncio e a transferência própria voltaria a contar como custo fixo.
     */
    expect((leitura.match(/AND: \[\s*whereFluxoCaixa/g) ?? []).length)
      .toBeGreaterThanOrEqual(2)
    expect(leitura, 'spread do where com NOT por cima é o clobber')
      .not.toMatch(/\.\.\.whereFluxoCaixa\([^)]*\),\s*type: 'DEBIT'/)
  })

  it('⛔ o guard exige o VÍNCULO do cartão, nunca a flag sozinha (régua de 20/09)', () => {
    const i = leitura.indexOf('export const SEM_DUPLA_CONTAGEM')
    const bloco = leitura.slice(i, leitura.indexOf('\n}', i))
    expect(bloco).toContain('businessCreditCardId: { not: null }')
    expect(bloco, 'as DUAS portas do empréstimo').toContain('loanInstallmentPaid')
    expect(bloco).toContain('loanInstallmentPayments')
  })
})
