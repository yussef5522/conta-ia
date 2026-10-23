// ⛔⛔⛔ O SELETOR DE "ADICIONAR ITEM" DO REAL × TEÓRICO (23/10/2026).
//
// O print do dono: "caixa estreita, nome quebrando em 2 linhas, lista cortada pelo card, 1
// resultado só visível, e R$ aparecendo no resultado".
//
// ⭐⭐ A CAUSA DO RECORTE É CSS, NÃO Z-INDEX: o card do grupo é `overflow-hidden` (ele precisa
// disso pro `rounded-[16px]` cortar os cantos dos filhos), e `overflow: hidden` num ancestral
// RECORTA o descendente `absolute` qualquer que seja o `z-index` — o z-index só ordena pintura
// entre stacking contexts. É a MESMA cicatriz do menu do cartão ≍ (18/09), em que o dono clicou
// "parcela de empréstimo" e o seletor abriu SEM NENHUM CONTRATO (o nginx provou que o dado
// chegou: 200 · 8024 bytes). ***Menu que abre fora da vista é indistinguível de menu vazio.***
//
// ⚠️ E O GUARD É DE DOIS LADOS. O `BuscaItem` é COMPARTILHADO por 7 chamadores, e o preço é
// LEGÍTIMO em 6 deles (montar receita vendo o custo, entrada manual, itens do DANFE). Um guard
// que só afirmasse "não tem R$" aprovaria o dia em que o custo sumisse da ficha e o dono
// perdesse o número que faz o gesto dele funcionar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, blocoEntre } from './_leitura-de-fonte'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

const SELETOR = 'components/estoque/busca-item.tsx'
const RVT = 'app/(dashboard)/empresas/[id]/estoque/real-vs-teorico/page.tsx'
const FICHA = 'components/estoque/ficha-editor.tsx'

const seletor = semComentarios(ler(SELETOR))
const rvt = semComentarios(ler(RVT))
const ficha = semComentarios(ler(FICHA))

/** o bloco JSX do `<BuscaItem …/>` dentro da tela do Real × Teórico */
const chamadaNoRvt = blocoEntre(rvt, '<BuscaItem', '/>')

describe('⛔⛔ 1 — A CAIXA NUNCA É CORTADA PELO CARD (portal, não z-index)', () => {
  it('⭐⭐ o painel vai pro PORTAL — é o único jeito de sair do `overflow-hidden` do card', () => {
    expect(seletor).toContain("from 'react-dom'")
    expect(usosDe(seletor, 'createPortal')).toBeGreaterThanOrEqual(1)
    expect(seletor).toContain('document.body')
  })

  it('⛔ o painel é `fixed`, nunca `absolute` — `absolute` volta a ser recortado pelo ancestral', () => {
    const painel = blocoEntre(seletor, 'createPortal(', 'document.body')
    expect(painel).toContain('fixed')
    expect(painel).not.toMatch(/className="[^"]*\babsolute\b/)
  })

  it('⭐ a POSIÇÃO vem do dono único da conta (`posicaoFlutuante`), com o piso de 420', () => {
    expect(seletor).toContain("from '@/lib/ui/posicao-flutuante'")
    expect(usosDe(seletor, 'posicaoFlutuante')).toBeGreaterThanOrEqual(1)
    expect(seletor).toMatch(/minima:\s*LARGURA_MINIMA/)
    expect(seletor).toMatch(/LARGURA_MINIMA\s*=\s*420/)
  })

  it('⚠️ a posição é MEDIDA do campo e recalculada em scroll/resize (tela que rola)', () => {
    expect(usosDe(seletor, 'getBoundingClientRect')).toBeGreaterThanOrEqual(1)
    expect(seletor).toMatch(/addEventListener\('scroll'/)
    expect(seletor).toMatch(/addEventListener\('resize'/)
  })

  it('⛔⛔ e o CARD do grupo CONTINUA `overflow-hidden` — o conserto não pagou o arredondamento', () => {
    // ⭐ guard de dois lados: tirar o overflow "resolveria" o recorte e mataria o raio dos cantos
    expect(rvt).toMatch(/overflow-hidden rounded-\[16px\]/)
  })
})

describe('⭐ 2 — CADA RESULTADO EM UMA LINHA', () => {
  const linha = blocoEntre(seletor, 'res.map((it)', '</button>')

  it('⭐⭐ o nome TRUNCA — `min-w-0` + `truncate` é o par que impede a quebra em 2 linhas', () => {
    // ⚠️ sem o `min-w-0` o flex item se recusa a encolher abaixo do conteúdo e a quebra volta
    expect(linha).toMatch(/min-w-0[^"]*truncate|truncate[^"]*min-w-0/)
  })

  it('⭐ o lado direito não encolhe (`shrink-0`) — selo da unidade e ＋ ficam na linha', () => {
    expect(linha).toContain('shrink-0')
    expect(linha).toContain('it.unidadeControle')
  })

  it('⭐ quem já está no grupo DIZ por quê ("✓ adicionado"), em vez de só ficar apagado', () => {
    expect(linha).toContain('adicionado')
    expect(linha).toMatch(/dentro\s*\?/)
  })

  it('⚠️ o nome inteiro fica no `title` — truncar não pode esconder o que o dono procura', () => {
    expect(linha).toMatch(/title=\{it\.nome\}/)
  })
})

describe('⛔⛔ 3 — ZERO R$ NO PICKER DO REAL × TEÓRICO (lei RT1)', () => {
  it('⭐⭐ a tela do RVT passa `semDinheiro`', () => {
    expect(chamadaNoRvt).toContain('semDinheiro')
  })

  it('⛔ com `semDinheiro` o custo não entra NEM COMO TEXTO — a lei é que dinheiro não aparece', () => {
    const linha = blocoEntre(seletor, 'res.map((it)', '</button>')
    // o único caminho que imprime dinheiro está atrás do gate
    expect(linha).toMatch(/!semDinheiro\s*&&/)
    expect(usosDe(seletor, 'brl')).toBeGreaterThanOrEqual(1)
    // ⚠️ a asserção é sobre a ORDEM (o gate ANTES do dinheiro), não sobre uma janela de
    //    caracteres: janela de distância já produziu falso vermelho e falso verde nesta casa.
    expect(linha).toMatch(/!semDinheiro && \([\s\S]{0,160}brl\(/)
    expect(linha).toMatch(/!semDinheiro && \([\s\S]{0,200}sem custo/)
  })

  it('⛔⛔ O OUTRO LADO — o dinheiro continua VIVO no editor de ficha (6 chamadores legítimos)', () => {
    // ⚠️ montar receita vendo o custo médio é o que faz o gesto do dono funcionar; um guard
    //    que só proibisse o R$ aprovaria o dia em que ele sumisse de todas as telas.
    const chamadaNaFicha = blocoEntre(ficha, '<BuscaItem', '/>')
    expect(chamadaNaFicha).not.toContain('semDinheiro')
  })

  it('⭐ a prop nasce OPT-IN: o default é MOSTRAR o custo', () => {
    // sem default verdadeiro no destructuring — `semDinheiro` entra como undefined (falsy)
    expect(seletor).not.toMatch(/semDinheiro\s*=\s*true/)
    expect(seletor).toMatch(/semDinheiro\?:\s*boolean/)
  })
})

describe('⭐ 3b — A BUSCA É A DA CASA, E O VAZIO É HONESTO', () => {
  it('⭐ quem filtra é o SERVIDOR pela régua da casa (`filtrarPorBusca`), nunca `includes` cru', () => {
    // ⚠️ a cicatriz de 08/09 está escrita na própria rota: `contains` é case-SENSITIVE no
    //    PostgreSQL e case-INSENSITIVE no SQLite → "xis" achava 0 em prod e 1 em dev.
    const rota = semComentarios(ler('app/api/empresas/[id]/estoque/itens/route.ts'))
    expect(usosDe(rota, 'filtrarPorBusca')).toBeGreaterThanOrEqual(1)
    expect(rota).not.toMatch(/\.nome\.toLowerCase\(\)\.includes\(/)
  })

  it('⭐⭐ vazio DIZ o termo — "nada encontrado com «xyz»"', () => {
    expect(seletor).toContain('nada encontrado com')
    // e ele só aparece quando a busca foi feita e não achou (não é vazio de "ainda não digitei")
    expect(seletor).toMatch(/res\.length === 0 && termo/)
  })
})

describe('⭐⭐ 4 — ADIÇÃO EM SÉRIE: o painel fica aberto e focado', () => {
  it('⭐ a tela do RVT passa `emSerie`', () => {
    expect(chamadaNoRvt).toContain('emSerie')
  })

  it('⛔⛔ e NÃO fecha o seletor depois de adicionar — era o que obrigava a reabrir pro 2º item', () => {
    expect(chamadaNoRvt).not.toContain('setAdicionando(false)')
  })

  it('⭐ com `emSerie` o componente SEGURA o painel e devolve o foco ao campo', () => {
    const escolher = blocoEntre(seletor, 'const escolher =', '\n  }')
    expect(escolher).toMatch(/if \(emSerie\)/)
    expect(escolher).toContain('campoRef.current?.focus()')
    // o `return` antes do fechamento é o que mantém o painel aberto
    expect(blocoEntre(escolher, 'if (emSerie)', '}')).toContain('return')
  })

  it('⭐ o selo "✓ adicionado" vem do SERVIDOR (`jaAdicionados` das linhas recarregadas)', () => {
    // ⚠️ o estado novo nasce do que o servidor GRAVOU (o gesto faz `await carregar()`),
    //    nunca do clique — dizer "adicionado" a partir do próprio clique afirmaria uma
    //    gravação que pode não ter acontecido.
    expect(chamadaNoRvt).toMatch(/jaAdicionados=\{s\.linhas\.map\(\(l\) => l\.itemId\)\}/)
    expect(chamadaNoRvt).toContain('await onGesto(')
  })

  it('⛔ nenhuma porta de gravação nova — o gesto é o `adicionarItem` de sempre', () => {
    expect(chamadaNoRvt).toContain("gesto: 'adicionarItem'")
  })
})

describe('⛔⛔ 5 — O GESTO NÃO MORRE NO PORTAL (clique-fora com os DOIS refs)', () => {
  it('⭐⭐ o `useDismissivel` recebe o ref do PAINEL além do container', () => {
    // ⛔ com UM ref só, o clique num resultado conta como "fora" (o painel não é descendente
    //    do container) → o `mousedown` fecha ANTES do `click` chegar → o item NUNCA é adicionado
    const chamada = blocoEntre(seletor, 'useDismissivel<', '\n')
    expect(chamada).toContain('aberto')
    expect(chamada).toContain('painelRef')
    expect(usosDe(seletor, 'painelRef')).toBeGreaterThanOrEqual(2) // declarado + pendurado no painel
  })

  it('⭐ a régua dos dois containers mora em função PURA, não dentro do efeito', () => {
    const hook = semComentarios(ler('lib/hooks/use-dismissivel.ts'))
    expect(hook).toMatch(/export function cliqueFoiForaDeTodos/)
    expect(usosDe(hook, 'cliqueFoiForaDeTodos')).toBeGreaterThanOrEqual(2)
  })
})

describe('⭐ 6 — teto de 8 resultados, casado com o espaço REAL', () => {
  it('a lista rola e o teto sai do espaço que a conta devolveu', () => {
    expect(seletor).toMatch(/RESULTADOS_VISIVEIS\s*=\s*8/)
    expect(seletor).toMatch(/Math\.min\(pos\.maxAltura[^)]*ALTURA_DA_LINHA \* RESULTADOS_VISIVEIS\)/)
  })

  it('⚠️ o criar/vazio fica FORA da lista que rola — senão sai da vista quando a busca não acha', () => {
    const painel = blocoEntre(seletor, 'createPortal(', 'document.body')
    const lista = blocoEntre(painel, 'overflow-y-auto', '</div>')
    expect(lista).not.toContain('nada encontrado com')
  })
})
