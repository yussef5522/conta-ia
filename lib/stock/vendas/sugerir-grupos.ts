// ⭐⭐ SUGESTÃO DE GRUPO DE GRAFIA — sugere, NUNCA decide (03/09/2026).
//
// O PDV manda o mesmo sabor escrito de vários jeitos. MEDIDO no relatório real: **31 grupos**
// de grafia. Sem juntar as pontas, limpar a tela exigiria mapear grafia por grafia — ~31
// viagens à mão pra dizer 31 vezes a mesma coisa.
//
// ⛔ E ISSO NÃO PODE VIRAR FUSÃO AUTOMÁTICA. A régua do módulo é a mesma de sempre
// ("o memo diz Transferência" · "categoria é decisão do dono"): **heurística sugere na tela,
// o dono confirma, o sistema nunca funde sozinho.** Aqui o estrago de errar é concreto — dois
// sabores diferentes apontados pra mesma ficha baixam o insumo errado, e em silêncio.
//
// ⚠️ NADA É FUNDIDO NO DADO em nenhum caso: o resultado disto é uma lista de nomes crus que
// o dono manda mapear JUNTOS. Cada nome continua gravado como o PDV escreveu.

import { normalizarNome } from './grupo-complemento'

export interface NomePendente {
  nomeSuitable: string
  ocorrencias: number
}

export interface Parecida extends NomePendente {
  /** por que o sistema achou parecido — a tela MOSTRA, pro dono julgar em vez de confiar */
  motivo: 'quase igual' | 'começa igual'
}

export interface FichaIrma {
  fichaId: string
  nomeFicha: string
  /** a grafia que já está apontando pra ela — a prova de que a ficha é DESTE nome */
  viaGrafia: string
}

export interface GrupoSugerido {
  /** a forma normalizada que uniu as grafias (uso interno/estável pra key de lista) */
  chave: string
  /** o nome de MAIOR volume — é o que o PDV usa de fato, e vira o rótulo */
  titulo: string
  /** as grafias que são a MESMA string ignorando caixa, acento e espaço repetido */
  nomes: NomePendente[]
  ocorrencias: number
  /** candidatas que **não** entram sozinhas: o dono inclui por clique */
  parecidas: Parecida[]
  /**
   * ⭐⭐ A FICHA QUE JÁ EXISTE PRA ESTE MESMO NOME (03/09).
   *
   * ⛔ BUG REAL: o dono clicou "criar ficha pra todas" no grupo do BACON e o salvar recusou
   * com *"já existe essa ficha"*. **A recusa estava certa** (nunca criar segunda ficha do
   * mesmo nome) — errado era o BOTÃO: uma grafia irmã (`BACON`) já estava mapeada numa ficha
   * de uma tentativa anterior, e o grupo não olhava pra isso. O gesto morria no erro em vez
   * de terminar o trabalho.
   *
   * ⚠️ MEDIDO: 14 grafias ficaram penduradas assim (bacon/Bacon, strogonoff, filé acebolado…).
   * Nenhuma ficha órfã — só trabalho parado.
   */
  fichaIrma: FichaIrma | null
}

/** distância de edição clássica, iterativa (nomes são curtos; sem dependência nova) */
export function distancia(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m || !n) return m || n
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...Array(n).fill(0)]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/**
 * ⛔⛔ DIFERENÇA EM DÍGITO NUNCA É "quase igual".
 *
 * `4 QUEIJOS` × `5 QUEIJOS` têm distância **1** e são sabores DIFERENTES. O mesmo vale pra
 * `PIZZA PEQUENA 25CM` × `45CM`. No cardápio real, número quase sempre é tamanho ou
 * quantidade — ou seja, exatamente o que **não** se junta. Sugerir isso seria alarme falso
 * no primeiro uso, e alarme falso repetido é como um alarme morre.
 */
export function difereSoEmDigito(a: string, b: string): boolean {
  const soLetras = (s: string) => s.replace(/\d/g, '')
  const digitos = (s: string) => (s.match(/\d/g) ?? []).join('')
  return soLetras(a) === soLetras(b) && digitos(a) !== digitos(b)
}

/**
 * ⛔⛔ "COMEÇA IGUAL" APERTADO — medido contra os 183 pendentes reais (03/09).
 *
 * A 1ª versão casava PREFIXO **ou SUFIXO** e virou enxurrada: `frango com bacon` e
 * `XIS - BACON` apareciam como "parecidas" de `bacon` (sufixo), e `BORDA MUSSARELA` juntava
 * **8 candidatas** (`COM ALHO`, `COM CATUPIRY`, `FAMILIA`, `GRANDE`…). Nome de complemento
 * se COMPÕE — sufixo não diz parentesco, e "X COM Y" é outro produto, não outra grafia de X.
 *
 * ⚠️ Alarme falso repetido mata o alarme: 24 grupos com sugestão errada ensinariam o dono a
 * ignorar a faixa inteira já no primeiro uso.
 *
 * O que sobra é o caso que o dono citou — **sufixo de promoção**: `CALABRESA BLACK FRIDAY`.
 * Regra: começa com a base + ATÉ 2 palavras a mais, e a 1ª delas **não é conector**
 * (`COM`, `DE`, `C/`, `E`, `SEM`) nem palavra de TAMANHO — as duas famílias que significam
 * "produto diferente", não "mesmo nome escrito de outro jeito".
 */
const CONECTOR = new Set(['COM', 'DE', 'DA', 'DO', 'E', 'SEM', 'C/', 'NO', 'NA'])
const TAMANHO = new Set(['FAMILIA', 'GRANDE', 'PEQUENA', 'PEQUENO', 'MEDIA', 'MEDIO', 'BROTO', 'GG', 'G', 'P', 'M'])

export function comecaIgual(base: string, outra: string): boolean {
  if (!outra.startsWith(`${base} `)) return false
  const extra = outra.slice(base.length + 1).split(' ').filter(Boolean)
  if (extra.length === 0 || extra.length > 2) return false
  return !CONECTOR.has(extra[0]) && !TAMANHO.has(extra[0]) && !TAMANHO.has(extra[extra.length - 1])
}

const MAX_DISTANCIA = 2
const MIN_TAMANHO_PARA_DISTANCIA = 6

/**
 * Agrupa os PENDENTES por grafia e devolve, junto, as candidatas a confirmar.
 *
 * ⭐ O grupo AUTOMÁTICO é só o que é a mesma string ignorando caixa/acento/espaço — aí não
 * há julgamento a fazer: `strogonoff de carne` e `STROGONOFF DE CARNE` são o mesmo texto.
 * Tudo que exige julgamento (typo, promoção, tamanho) fica em `parecidas`, pro dono clicar.
 */
export interface GrafiaMapeada {
  nomeSuitable: string
  fichaId: string
  nomeFicha: string
}

export function sugerirGruposDeGrafia(
  pendentes: readonly NomePendente[],
  /** as grafias que JÁ apontam pra alguma ficha — é o que evita o beco do "já existe" */
  jaMapeadas: readonly GrafiaMapeada[] = [],
): GrupoSugerido[] {
  const porNorm = new Map<string, NomePendente[]>()
  for (const p of pendentes) {
    const k = normalizarNome(p.nomeSuitable)
    porNorm.set(k, [...(porNorm.get(k) ?? []), p])
  }

  // ⭐ índice das grafias já resolvidas, pela MESMA normalização: se uma irmã do grupo já
  // tem ficha, o grupo inteiro pertence a ela.
  const irmaPorNorm = new Map<string, FichaIrma>()
  for (const m of jaMapeadas) {
    const k = normalizarNome(m.nomeSuitable)
    if (!irmaPorNorm.has(k)) irmaPorNorm.set(k, { fichaId: m.fichaId, nomeFicha: m.nomeFicha, viaGrafia: m.nomeSuitable })
  }

  const grupos: GrupoSugerido[] = []
  for (const [chave, nomes] of porNorm) {
    const ordenados = [...nomes].sort((a, b) => b.ocorrencias - a.ocorrencias)
    const parecidas: Parecida[] = []
    for (const [outraChave, outros] of porNorm) {
      if (outraChave === chave) continue
      // ⚠️ só oferece a candidata pro grupo MAIOR, senão a mesma dupla apareceria dos dois
      // lados e o dono veria a decisão duplicada.
      const volumeDela = outros.reduce((s, x) => s + x.ocorrencias, 0)
      const volumeDaqui = nomes.reduce((s, x) => s + x.ocorrencias, 0)
      if (volumeDela > volumeDaqui || (volumeDela === volumeDaqui && outraChave < chave)) continue

      let motivo: Parecida['motivo'] | null = null
      if (comecaIgual(chave, outraChave)) motivo = 'começa igual'
      else if (
        chave.length >= MIN_TAMANHO_PARA_DISTANCIA && outraChave.length >= MIN_TAMANHO_PARA_DISTANCIA
        && !difereSoEmDigito(chave, outraChave)
        && distancia(chave, outraChave) <= MAX_DISTANCIA
      ) motivo = 'quase igual'
      if (motivo) for (const o of outros) parecidas.push({ ...o, motivo })
    }

    grupos.push({
      chave,
      titulo: ordenados[0].nomeSuitable,
      nomes: ordenados,
      ocorrencias: nomes.reduce((s, x) => s + x.ocorrencias, 0),
      parecidas: parecidas.sort((a, b) => b.ocorrencias - a.ocorrencias),
      fichaIrma: irmaPorNorm.get(chave) ?? null,
    })
  }

  return grupos.sort((a, b) => b.ocorrencias - a.ocorrencias || a.titulo.localeCompare(b.titulo, 'pt-BR'))
}
