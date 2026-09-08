// ⭐⭐⭐ O CARDÁPIO POR SEÇÕES (08/09/2026) — as seções são do DONO, a sugestão é da régua.
//
// *"Agrupar os produtos como o cardápio real, pra eu ver por setor o que tem ficha e o que
// falta. (…) A CLASSIFICAÇÃO INICIAL não pode ser 156 cliques meus: heurística sugere, eu
// bato o martelo — **mas num gesto, não em 156**."*
//
// ⛔⛔ A RÉGUA DE PALAVRAS É CONFIG, NÃO ADIVINHAÇÃO. Ela mora aqui, em código editável e
// com teste — não num modelo que "aprende" nem numa distância de string. O dono ditou os
// pares (XIS→Xis, BURGER→Burgers, COCA/FRUKI/2L→Bebidas…), e é isso que está escrito.
// Palavra que não bate **não vira palpite**: cai em Outros, à vista.
//
// ⚠️ E TODA SUGESTÃO NASCE MARCADA. Enquanto o dono não confirma, a seção do produto é uma
// PROPOSTA — a tela mostra isso, e o lote de revisão existe pra ele confirmar tudo de uma
// vez. É a mesma disciplina do resto do módulo: *a previsão SUGERE, nunca preenche*.

/** as seções que o dono ditou, na ordem dele — SEED, não veredito: a lista é editável */
export const SECOES_SEED: readonly { chave: string; nome: string; ordem: number }[] = [
  { chave: 'XIS', nome: 'Xis', ordem: 1 },
  { chave: 'BURGERS', nome: 'Burgers', ordem: 2 },
  { chave: 'LANCHES', nome: 'Lanches', ordem: 3 },
  { chave: 'PORCOES', nome: 'Porções e Fritas', ordem: 4 },
  { chave: 'FRANGO_FRITO', nome: 'Frango Frito', ordem: 5 },
  { chave: 'PRATOS', nome: 'Pratos', ordem: 6 },
  { chave: 'PIZZAS', nome: 'Pizzas', ordem: 7 },
  { chave: 'BEBIDAS', nome: 'Bebidas', ordem: 8 },
  { chave: 'DOCES', nome: 'Doces e Sobremesas', ordem: 9 },
  { chave: 'OUTROS', nome: 'Outros', ordem: 99 },
]

/** ⛔ o destino de quem não bate em regra nenhuma — **visível, nunca some** */
export const SECAO_PADRAO = 'OUTROS'

/**
 * ⭐ A RÉGUA, palavra por palavra, na ordem em que é testada.
 *
 * ⚠️⚠️ A ORDEM É A REGRA: a primeira que casar vence — **e a justificativa que eu tinha
 * escrito aqui estava ERRADA**. Eu dizia que `FRANGO FRITO` precisava vir antes de `FRITAS`
 * "senão cairia em Porções por causa do FRIT". Não cairia: a borda de palavra já separa
 * `FRITO` de `FRITAS`, e a REGRA 11 mostrou isso — repus o defeito (movi a linha pro fim) e
 * **nenhum teste ficou vermelho**.
 *
 * ⭐ Onde a ordem MORDE de verdade é no nome que casa em DUAS regras inteiras:
 * `PORCAO DE FRANGO FRITO` bate em `FRANGO FRITO` **e** em `PORCAO`. Aí a primeira decide —
 * e ela é Frango Frito de propósito: o específico ganha do genérico. É esse caso que o
 * teste trava agora.
 */
export const REGRAS_DE_PALAVRA: readonly { termos: readonly string[]; secao: string }[] = [
  // ⛔ os mais específicos primeiro — ver o aviso acima
  { termos: ['FRANGO FRITO', 'FRANGO A PASSARINHO', 'PASSARINHO'], secao: 'FRANGO_FRITO' },
  { termos: ['A LA MINUTA', 'MINUTA', 'PRATO', 'BIFE A CAVALO'], secao: 'PRATOS' },
  { termos: ['HOT DOG', 'CACHORRO QUENTE', 'CACHORRO', 'TORRADA', 'BAURU', 'MISTO'], secao: 'LANCHES' },
  { termos: ['XIS'], secao: 'XIS' },
  { termos: ['BURGER', 'BURGUER', 'HAMBURGUER', 'HAMBURGER', 'SMASH'], secao: 'BURGERS' },
  { termos: ['PIZZA', 'PROMO PIZZAS', 'CALZONE'], secao: 'PIZZAS' },
  { termos: ['FRITAS', 'BATATA', 'PORCAO', 'PORCOES', 'POLENTA', 'ONION', 'NUGGETS'], secao: 'PORCOES' },
  {
    termos: [
      'COCA', 'FRUKI', 'SPRITE', 'GUARANA', 'PEPSI', 'FANTA', 'SUCO', 'AGUA', 'CERVEJA',
      'HEINEKEN', 'BRAHMA', 'SKOL', 'REFRI', 'LATA', '2L', '600ML', '1L', 'ENERGETICO',
    ],
    secao: 'BEBIDAS',
  },
  { termos: ['SOBREMESA', 'PUDIM', 'MOUSSE', 'SORVETE', 'ACAI', 'DOCE', 'BRIGADEIRO', 'PETIT'], secao: 'DOCES' },
]

/** a MESMA normalização do resto do módulo de vendas: caixa e acento não separam nada */
function normalizar(n: string): string {
  return (n ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

export interface SugestaoDeSecao {
  secao: string
  /** a palavra que decidiu — ⛔ a tela MOSTRA isso: sugestão sem motivo é adivinhação */
  porQue: string | null
}

/**
 * A seção sugerida pra um nome de produto.
 *
 * ⛔ Sem regra que case → `OUTROS` com `porQue: null`. **Nunca chuta pelo parecido**: um
 * nome desconhecido em Outros é trabalho de 1 clique; um nome na seção errada é um número
 * errado no relatório de cobertura, e ninguém desconfia de número.
 */
export function sugerirSecao(nome: string): SugestaoDeSecao {
  const n = normalizar(nome)
  if (!n) return { secao: SECAO_PADRAO, porQue: null }
  for (const r of REGRAS_DE_PALAVRA) {
    for (const t of r.termos) {
      // ⚠️ palavra INTEIRA na borda, não `includes` solto: sem isso "AGUA" casaria dentro
      // de "GUARDANAPO" e "LATA" dentro de "SALATA". A borda é o que separa regra de acaso.
      const alvo = normalizar(t)
      const re = new RegExp(`(^|[^A-Z0-9])${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z0-9]|$)`)
      if (re.test(n)) return { secao: r.secao, porQue: t }
    }
  }
  return { secao: SECAO_PADRAO, porQue: null }
}

// ────────────────────────────────────────────────────────────────
// O agrupamento da tela
// ────────────────────────────────────────────────────────────────

export interface LinhaComSecao {
  chave: string
  nome: string
  nomesSuitable: string[]
  /** a seção VIGENTE: a confirmada pelo dono, ou a sugerida, ou OUTROS */
  secao: string
  /** ⚠️ ainda é proposta — a tela marca, e o lote de revisão existe pra isso */
  sugerida: boolean
  temFicha: boolean
  vendasQtd: number
}

export interface GrupoDeSecao<T extends LinhaComSecao = LinhaComSecao> {
  secao: string
  nome: string
  ordem: number
  linhas: T[]
  /** ⛔ o header soma CERTO: comFicha + semFicha === total, sempre */
  total: number
  comFicha: number
  semFicha: number
  /** 0..1 — `null` quando a seção está vazia (0% afirmaria "nada coberto") */
  cobertura: number | null
  vendasQtd: number
}

/**
 * Agrupa as linhas nas seções, na ORDEM DO DONO.
 *
 * ⚠️ Seção vazia entra na lista mesmo assim, com contador zero — some da tela é decisão da
 * TELA (colapsar), não do dado. Sumir aqui esconderia que a seção existe e está sem nada.
 */
export function agruparPorSecao<T extends LinhaComSecao>(
  linhas: readonly T[],
  secoes: readonly { chave: string; nome: string; ordem: number }[],
): GrupoDeSecao<T>[] {
  const porChave = new Map<string, T[]>()
  for (const l of linhas) {
    // ⛔ seção que não existe mais na lista do dono cai em OUTROS — nunca some da tela
    const k = secoes.some((s) => s.chave === l.secao) ? l.secao : SECAO_PADRAO
    porChave.set(k, [...(porChave.get(k) ?? []), l])
  }
  return [...secoes]
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((s) => {
      const ls = porChave.get(s.chave) ?? []
      const comFicha = ls.filter((l) => l.temFicha).length
      return {
        secao: s.chave, nome: s.nome, ordem: s.ordem, linhas: ls,
        total: ls.length, comFicha, semFicha: ls.length - comFicha,
        cobertura: ls.length ? comFicha / ls.length : null,
        vendasQtd: ls.reduce((acc, l) => acc + l.vendasQtd, 0),
      }
    })
}

// ────────────────────────────────────────────────────────────────
// O lote de revisão
// ────────────────────────────────────────────────────────────────

export interface ItemDoLote {
  chave: string
  nome: string
  nomesSuitable: string[]
  secaoSugerida: string
  porQue: string | null
  vendasQtd: number
}

export interface LoteDeClassificacao {
  /** os grupos que o dono vai correr o olho, os maiores primeiro */
  grupos: { secao: string; itens: ItemDoLote[] }[]
  total: number
  /** ⚠️ quantos a régua NÃO soube classificar — o número honesto do trabalho que sobra */
  semRegra: number
}

/**
 * ⭐⭐ O LOTE: os N produtos agrupados pela sugestão, pro dono confirmar de uma vez.
 *
 * ⛔ Só entra quem AINDA NÃO TEM seção confirmada. Reclassificar o que o dono já bateu o
 * martelo seria reabrir decisão pronta — a mesma regra que o agrupamento de grafias segue.
 */
export function montarLote(
  produtos: readonly { chave: string; nome: string; nomesSuitable: string[]; vendasQtd: number }[],
  jaConfirmados: ReadonlySet<string>,
): LoteDeClassificacao {
  const porSecao = new Map<string, ItemDoLote[]>()
  let semRegra = 0
  for (const p of produtos) {
    if (jaConfirmados.has(p.chave)) continue
    const s = sugerirSecao(p.nome)
    if (!s.porQue) semRegra++
    porSecao.set(s.secao, [...(porSecao.get(s.secao) ?? []), {
      chave: p.chave, nome: p.nome, nomesSuitable: p.nomesSuitable,
      secaoSugerida: s.secao, porQue: s.porQue, vendasQtd: p.vendasQtd,
    }])
  }
  const grupos = [...porSecao.entries()]
    .map(([secao, itens]) => ({
      secao,
      itens: [...itens].sort((a, b) => b.vendasQtd - a.vendasQtd || a.nome.localeCompare(b.nome, 'pt-BR')),
    }))
    // ⚠️ OUTROS por último mesmo sendo grande: é a pilha do "não sei", e ela não pode
    // encabeçar a revisão — o dono confirma o que a régua acertou antes de garimpar.
    .sort((a, b) => (a.secao === SECAO_PADRAO ? 1 : b.secao === SECAO_PADRAO ? -1 : b.itens.length - a.itens.length))
  return { grupos, total: grupos.reduce((s, g) => s + g.itens.length, 0), semRegra }
}
