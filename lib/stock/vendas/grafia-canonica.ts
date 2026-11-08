// ⭐⭐⭐ GRAFIA IGUAL É O MESMO SABOR, POR CONSTRUÇÃO (08/09/2026) — decisão do dono.
//
// *"A tela mostra 'frango com catupiry (2) · já existe ficha via FRANGO COM CATUPIRY —
// mapear nessa ficha' me pedindo clique. **Se o nome canônico é IDÊNTICO (só caixa/acento
// difere), isso não é heurística sugerindo — é a mesma palavra.**"*
//
// ⛔⛔ A FRONTEIRA É O CORAÇÃO DESTE ARQUIVO, e ela é dura:
//
//   AUTOMÁTICO — `normalizarNome(a) === normalizarNome(b)`. Mesma string ignorando
//   caixa, acento e espaço repetido. Não há julgamento a fazer: `frango com catupiry` e
//   `FRANGO COM CATUPIRY` são o MESMO TEXTO. Automatizar isso não é adivinhar.
//
//   PEDE CLIQUE — tudo o mais, e cada um por um motivo próprio:
//     · TYPO: `STROGONOFF DE CARNEE` ≠ `STROGONOFF DE CARNE`. **Uma letra a mais é palavra
//       diferente** — e neste cardápio as DUAS existem de verdade (o cardápio escreve com
//       EE, o PDV sem), então "corrigir" sozinho apagaria um sabor real.
//     · COMEÇA IGUAL: `MUSSARELA ACEBOLADA` ⊄ `MUSSARELA`. São dois pratos do cardápio.
//     · DÍGITO: `4 QUEIJOS` ≠ `5 QUEIJOS`. Um caractere, outro produto.
//     · SUFIXO DE TAMANHO/PROMO: sugestão FORTE, mas ainda clique — ver abaixo.
//
// ⚠️ E A RÉGUA DO AUTOMÁTICO É A MESMA `normalizarNome` QUE A TELA JÁ USA PRA AGRUPAR.
// Escrever uma segunda normalização aqui seria a lição do B1 outra vez: duas derivações da
// mesma pergunta divergem no primeiro caso de borda.

import { normalizarNome } from './grupo-complemento'

/**
 * ⭐⭐ O CANÔNICO DA GRAFIA — a chave do automático, pra COMPLEMENTOS e PRODUTOS (08/11/2026).
 *
 * É o `normalizarNome` (caixa, acento, espaço) **mais a pontuação**, por decisão do dono de
 * 08/11: *"diferença SÓ de pontuação (hífen) também é o mesmo produto"*. O PDV manda
 * `XIS - COMPLETO`, `XIS COMPLETO` e `Xis Completo` pro mesmo lanche, e
 * `Pizza Grande (35cm)` pra `PIZZA GRANDE 35CM`.
 *
 * ⛔ O que continua DIFERENTE é a LETRA e o DÍGITO: tudo que é `[A-Z0-9]` fica. Um typo
 * (`CARNEE`) ou um dígito (`4 QUEIJOS` × `5 QUEIJOS`) segue pedindo clique. E a pontuação vira
 * ESPAÇO, não some: `1/2` vira `1 2`, que não colide com `12`.
 *
 * ⚠️ Nome só de pontuação dá chave vazia; aí volta o `normalizarNome`, pra que dois nomes
 * diferentes feitos só de símbolo nunca virem "o mesmo".
 *
 * ⛔ `normalizarNome` NÃO mudou: ele serve ao cardápio de sabores e à busca. Quem pergunta
 * "estas duas grafias são o mesmo item?" usa ESTA função, e é uma só.
 */
export function canonicoDaGrafia(n: string): string {
  const base = normalizarNome(n)
  const k = base.replace(/[^A-Z0-9]+/g, ' ').trim()
  return k || base
}

export interface GrafiaPendente {
  nomeSuitable: string
  ocorrencias: number
}

export interface GrafiaComFicha {
  nomeSuitable: string
  fichaId: string
  nomeFicha: string
}

// ────────────────────────────────────────────────────────────────
// 1. O AUTOMÁTICO — canônico igual
// ────────────────────────────────────────────────────────────────

export interface AgrupamentoAutomatico {
  /** a grafia pendente que entra no mapa sozinha */
  nomeSuitable: string
  ocorrencias: number
  fichaId: string
  nomeFicha: string
  /** a grafia irmã que JÁ apontava pra essa ficha — o rastro de "por que entrou" */
  viaGrafia: string
}

/**
 * As grafias pendentes cujo canônico já tem ficha. Entram no mapa **sem clique**.
 *
 * ⚠️ Quando mais de uma grafia já mapeada tem o mesmo canônico, vence a PRIMEIRA da lista —
 * e isso é seguro porque todas apontam pro mesmo canônico; se apontassem pra fichas
 * diferentes seria um conflito do dado, não desta função. `conflitosDeGrafia` acha esses.
 */
export function agrupamentoAutomatico(
  pendentes: readonly GrafiaPendente[],
  jaMapeadas: readonly GrafiaComFicha[],
): AgrupamentoAutomatico[] {
  const porCanonico = new Map<string, GrafiaComFicha>()
  for (const m of jaMapeadas) {
    const k = canonicoDaGrafia(m.nomeSuitable)
    if (!porCanonico.has(k)) porCanonico.set(k, m)
  }
  const out: AgrupamentoAutomatico[] = []
  for (const p of pendentes) {
    const irma = porCanonico.get(canonicoDaGrafia(p.nomeSuitable))
    // ⚠️ a própria grafia já mapeada não é "pendente"; se aparecer, ignora sem drama
    if (!irma || irma.nomeSuitable === p.nomeSuitable) continue
    out.push({
      nomeSuitable: p.nomeSuitable, ocorrencias: p.ocorrencias,
      fichaId: irma.fichaId, nomeFicha: irma.nomeFicha, viaGrafia: irma.nomeSuitable,
    })
  }
  return out.sort((a, b) => b.ocorrencias - a.ocorrencias)
}

/**
 * ⛔ CONFLITO: o mesmo canônico apontando pra fichas DIFERENTES.
 *
 * Não pode existir por construção da regra, mas pode existir por dado antigo — e aí o
 * automático precisa **parar e mostrar**, não escolher uma. Escolher seria exatamente a
 * adivinhação que a regra proíbe.
 */
export function conflitosDeGrafia(
  jaMapeadas: readonly GrafiaComFicha[],
): { canonico: string; fichas: GrafiaComFicha[] }[] {
  const porCanonico = new Map<string, GrafiaComFicha[]>()
  for (const m of jaMapeadas) {
    const k = canonicoDaGrafia(m.nomeSuitable)
    porCanonico.set(k, [...(porCanonico.get(k) ?? []), m])
  }
  return [...porCanonico.entries()]
    .filter(([, ms]) => new Set(ms.map((m) => m.fichaId)).size > 1)
    .map(([canonico, fichas]) => ({ canonico, fichas }))
}

// ────────────────────────────────────────────────────────────────
// 1b. O RESOLVEDOR — a mesma régua, aplicada na LEITURA (produtos, 08/11/2026)
// ────────────────────────────────────────────────────────────────

/** o que o resolvedor precisa de uma linha do mapa (produto: FICHA/REVENDA/IGNORAR) */
export interface GrafiaMapeada {
  nomeSuitable: string
  alvoTipo: string
  fichaId: string | null
  itemId?: string | null
}

export type ResolucaoDeGrafia<T extends GrafiaMapeada> =
  /** a grafia crua TEM linha no mapa — a decisão do dono pra este nome, intocada */
  | { tipo: 'EXATA'; mapa: T }
  /** a grafia crua não tem linha, mas uma irmã do mesmo canônico tem, e todas as irmãs apontam pro MESMO destino */
  | { tipo: 'CANONICA'; mapa: T; viaGrafia: string }
  /** ⛔ irmãs do mesmo canônico com destinos DIFERENTES: nunca escolher, mostrar */
  | { tipo: 'CONFLITO'; candidatas: T[] }
  | { tipo: 'SEM' }

/** o destino que uma linha do mapa representa — dois iguais são "o mesmo lugar" */
function destinoDe(m: GrafiaMapeada): string | null {
  if (m.alvoTipo === 'FICHA' && m.fichaId) return `FICHA:${m.fichaId}`
  if (m.alvoTipo === 'REVENDA' && m.itemId) return `REVENDA:${m.itemId}`
  return null
}

/**
 * ⭐⭐ A PORTA ÚNICA DA LEITURA DO MAPA DE PRODUTO (08/11/2026).
 *
 * O mapa continua guardando a string CRUA (N grafias → 1 destino); quem canonicaliza é o
 * LOOKUP. ⛔ Nada aqui grava: fundir no dado faria o import de amanhã não reconhecer a grafia
 * que sumiu (o mesmo aviso do `chaveDeApresentacao`, que vale igual pra produto).
 *
 * As regras, em ordem:
 *   1. a grafia crua tem linha → EXATA (inclusive IGNORAR: ignorar é decisão por NOME);
 *   2. senão, as irmãs do mesmo `canonicoDaGrafia` com destino (FICHA/REVENDA) decidem:
 *      todas no mesmo destino → CANONICA; destinos diferentes → CONFLITO, e a linha NÃO
 *      baixa até o dono escolher. ⛔ Escolher a primeira seria a adivinhação que a regra
 *      proíbe, e no dado de 08/11 o caso existe: `XIS COMPLETO` e `XIS - COMPLETO` apontam
 *      pra DUAS fichas ativas diferentes;
 *   3. IGNORAR de uma irmã NÃO se propaga: ignorar `GRANDE` não diz nada de outra grafia;
 *   4. nenhuma irmã → SEM.
 */
export function resolvedorDeGrafia<T extends GrafiaMapeada>(mapa: readonly T[]): (nome: string) => ResolucaoDeGrafia<T> {
  const exato = new Map<string, T>()
  const porCanonico = new Map<string, T[]>()
  for (const m of mapa) {
    if (!exato.has(m.nomeSuitable)) exato.set(m.nomeSuitable, m)
    if (destinoDe(m) === null) continue
    const k = canonicoDaGrafia(m.nomeSuitable)
    porCanonico.set(k, [...(porCanonico.get(k) ?? []), m])
  }
  return (nome: string) => {
    const e = exato.get(nome)
    if (e) return { tipo: 'EXATA', mapa: e }
    const irmas = porCanonico.get(canonicoDaGrafia(nome)) ?? []
    if (irmas.length === 0) return { tipo: 'SEM' }
    if (new Set(irmas.map(destinoDe)).size > 1) return { tipo: 'CONFLITO', candidatas: irmas }
    return { tipo: 'CANONICA', mapa: irmas[0], viaGrafia: irmas[0].nomeSuitable }
  }
}

/** a linha do mapa que DECIDE este nome (EXATA ou CANONICA); null = sem destino ou conflito */
export function mapaQueDecide<T extends GrafiaMapeada>(r: ResolucaoDeGrafia<T>): T | null {
  return r.tipo === 'EXATA' || r.tipo === 'CANONICA' ? r.mapa : null
}

// ────────────────────────────────────────────────────────────────
// 2. O SUFIXO DE TAMANHO/PROMO — sugestão forte, clique obrigatório
// ────────────────────────────────────────────────────────────────

/**
 * ⭐ LISTA CURTA E EDITÁVEL — decisão do dono: *"a lista de sufixos é código/config
 * editável, não adivinhação por semelhança."*
 *
 * ⛔ Por que ela é FECHADA e não "qualquer palavra depois do nome": com lista aberta,
 * `CALABRESA BLACK FRIDAY` viraria sugestão de CALABRESA — e promoção com nome inventado
 * pode ser outro produto. Lista curta é o que separa "sei o que é FAMILIA" de "chutei".
 */
export const SUFIXOS_DE_TAMANHO: readonly string[] = [
  'FAMILIA', 'PROMO', 'GRANDE', 'MEDIO', 'PEQUENO', 'BROTO',
]

/** ⚠️ o PDV escreve o tamanho ANTES em alguns casos: "PIZZA PEQUENA CHOCOLATE PRETO" */
export const PREFIXOS_DE_TAMANHO: readonly string[] = [
  'PIZZA PEQUENA', 'PIZZA GRANDE', 'PIZZA MEDIA', 'PIZZA BROTO',
]

export interface SugestaoDeTamanho {
  nomeSuitable: string
  ocorrencias: number
  fichaId: string
  nomeFicha: string
  /** a grafia base já mapeada */
  base: string
  /** FAMILIA · PROMO · PIZZA PEQUENA … — o que sobrou depois de tirar a base */
  sufixo: string
  /** a frase que a tela mostra, montada aqui pra não existirem duas versões dela */
  frase: string
}

/**
 * Nome pendente que é **[nome já mapeado] + sufixo da lista** ganha sugestão destacada.
 *
 * ⛔⛔ SUGERE, NUNCA MAPEIA — e a razão é do dono: *"tamanho não muda a explosão
 * (1 ocorrência = 1 explosão, como sempre), então apelido na mesma ficha resolve"*. Ou
 * seja: o gesto é barato e reversível, mas **é dele**. Uma pizza família que consome duas
 * porções continuaria consumindo uma se alguém automatizasse isso por engano.
 *
 * ⚠️ E o casamento é por CANÔNICO da base, não por `startsWith` de texto cru: assim
 * `strogonoff de carne familia` acha `STROGONOFF DE CARNE` sem virar caso especial.
 */
export function sugestoesDeTamanho(
  pendentes: readonly GrafiaPendente[],
  jaMapeadas: readonly GrafiaComFicha[],
): SugestaoDeTamanho[] {
  const porCanonico = new Map<string, GrafiaComFicha>()
  for (const m of jaMapeadas) {
    const k = normalizarNome(m.nomeSuitable)
    if (!porCanonico.has(k)) porCanonico.set(k, m)
  }

  const out: SugestaoDeTamanho[] = []
  for (const p of pendentes) {
    const norm = normalizarNome(p.nomeSuitable)
    // ⚠️ o canônico já resolvido é trabalho do automático, não daqui
    if (porCanonico.has(norm)) continue

    let achado: { base: string; sufixo: string; irma: GrafiaComFicha } | null = null

    for (const suf of SUFIXOS_DE_TAMANHO) {
      if (!norm.endsWith(` ${suf}`)) continue
      const base = norm.slice(0, -(suf.length + 1)).trim()
      const irma = porCanonico.get(base)
      if (irma) { achado = { base, sufixo: suf, irma }; break }
    }
    if (!achado) for (const pre of PREFIXOS_DE_TAMANHO) {
      if (!norm.startsWith(`${pre} `)) continue
      const base = norm.slice(pre.length + 1).trim()
      const irma = porCanonico.get(base)
      if (irma) { achado = { base, sufixo: pre, irma }; break }
    }
    if (!achado) continue

    out.push({
      nomeSuitable: p.nomeSuitable, ocorrencias: p.ocorrencias,
      fichaId: achado.irma.fichaId, nomeFicha: achado.irma.nomeFicha,
      base: achado.irma.nomeSuitable, sufixo: achado.sufixo,
      frase: `é ${achado.irma.nomeFicha} tamanho ${achado.sufixo.toLowerCase()} — mapear como apelido?`,
    })
  }
  return out.sort((a, b) => b.ocorrencias - a.ocorrencias)
}

// ────────────────────────────────────────────────────────────────
// 3. A APRESENTAÇÃO — uma linha por canônico, também pros pendentes
// ────────────────────────────────────────────────────────────────

/**
 * ⭐ A chave de agrupamento da TELA.
 *
 * ⛔⛔ ATENÇÃO — ESTA FUNÇÃO É SÓ PRA APRESENTAR. O nome cru continua gravado como veio: é
 * ele que casa com o relatório de amanhã, e fundir no dado faria a importação do próximo dia
 * não reconhecer a grafia que sumiu (a venda deixaria de baixar **em silêncio**).
 */
export function chaveDeApresentacao(l: { destino: string; fichaId: string | null; nomeSuitable: string }): string {
  // quem tem ficha agrupa pela FICHA (dois canônicos diferentes podem servir a mesma)
  if (l.destino === 'FICHA' && l.fichaId) return `ficha:${l.fichaId}`
  // ⚠️ IGNORAR continua linha a linha: ignorar é decisão por NOME (um GRANDE não tem nada
  // a ver com um PEQUENO), e juntá-los esconderia o que exatamente foi ignorado.
  if (l.destino === 'IGNORAR') return `nome:${l.nomeSuitable}`
  // ⭐ PENDENTE agrupa por CANÔNICO — a mudança de 08/09.
  return `canonico:${canonicoDaGrafia(l.nomeSuitable)}`
}
