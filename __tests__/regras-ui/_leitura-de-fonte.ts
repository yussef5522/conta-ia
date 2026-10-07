/**
 * ⭐⭐ O DETECTOR DE "USO, NUNCA MENÇÃO" — UM lugar, não uma cópia por guard (07/10/2026).
 *
 * ⚠️⚠️ **NASCEU DE O GUARD TER VINDO VERDE COM O DEFEITO REPOSTO — a 11ª "menção, não uso"
 * desta casa, e a primeira por IMPORT MULTILINHA.** A versão anterior filtrava LINHA que
 * começa com `import`, então num import quebrado em três linhas
 *
 *     import {
 *       cartoesDoTopo, PRATELEIRAS,
 *     } from '@/lib/custos-fixos/prateleira'
 *
 * o nome sobrevivia na **segunda** linha e `usosDe` contava 1 **com a tela não chamando nada**.
 * Repus a aritmética própria na tela e os 168 testes passaram.
 *
 * ⭐ A cura não é um regex melhor por guard: é **um detector, um lugar** — porque duas cópias
 * do mesmo detector divergem, e foi exatamente por isso que esta passou cega.
 *
 * ⚠️ Este arquivo NÃO é coletado pelo vitest (o include é `*.test.ts`): é helper, não suíte.
 */

/**
 * ⚠️ Tira comentário de bloco, de linha e JSX — **o arquivo que documenta o defeito não pode
 * ser o que o absolve** (a lição de 21/09, no motor do Radar).
 */
export function semComentarios(s: string): string {
  return s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * ⛔⛔ Tira a DECLARAÇÃO de import inteira, **multilinha incluída** — é o que faltava.
 *
 * ⚠️ Casa `import … from '…'` com ou sem ponto-e-vírgula, e também `import '…'` (efeito
 * colateral). O `[\s\S]*?` é preguiçoso e para no primeiro `from '…'`, então dois imports
 * seguidos não viram um só.
 */
export function semImports(s: string): string {
  return s
    .replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?/gm, '')
    .replace(/^\s*import\s*['"][^'"]+['"];?/gm, '')
}

/** ⭐ conta o USO de um símbolo: sem comentário e sem import, multilinha incluída */
export function usosDe(src: string, nome: string): number {
  const limpo = semImports(semComentarios(src))
  return (limpo.match(new RegExp(`\\b${nome}\\b`, 'g')) ?? []).length
}

/** ⭐ o corpo de um bloco entre dois marcos — pra asserção ESTRUTURAL, não por distância */
export function blocoEntre(src: string, inicio: string, fim: string): string {
  const i = src.indexOf(inicio)
  if (i < 0) return ''
  const j = src.indexOf(fim, i + inicio.length)
  return j < 0 ? src.slice(i) : src.slice(i, j + fim.length)
}
