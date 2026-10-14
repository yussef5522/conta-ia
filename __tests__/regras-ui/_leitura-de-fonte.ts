import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
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
    .replace(COMENTARIO_JSX, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * ⛔⛔⛔ O COMENTÁRIO JSX SE FECHA NO PRIMEIRO FECHA-COMENTÁRIO, E ISSO NÃO É DETALHE DE REGEX
 * (08/10/2026).
 *
 * A versão anterior usava um `[\s\S]*?` preguiçoso entre `{` e `}` — e o FIM dela exigia o
 * fecha-comentário **seguido de `}`**. Num arquivo onde um bloco abre com `{` e a primeira
 * coisa dentro dele é um comentário de bloco (o caso trivial de `}) {` seguido de um JSDoc de
 * variável), o match **não parava no fecha-comentário dele**: corria até achar o primeiro
 * comentário JSX de verdade lá embaixo e **engolia tudo no meio**.
 *
 * ⚠️⚠️ MEDIDO: na central de import ele comeu **4.431 caracteres**, levando o container
 * (`max-w-[1440px]`), as medidas do celular e a `casaBusca` junto — e o guard passou a acusar
 * peças que ESTAVAM na tela, enquanto seria **cego** a qualquer defeito naquele trecho.
 * ***Detector com um lugar só é força; detector com um lugar só e um furo é cegueira em todos
 * os guards de uma vez.***
 *
 * ⭐ A cura é dizer NA FORMA o que um comentário de bloco é: abre-comentário, nada que contenha
 * o fecha, e o fecha. Assim o match **não pode** atravessar o fechamento, e o `{…}` em volta
 * precisa abraçar exatamente um comentário.
 */
const COMENTARIO_JSX = /\{\s*\/\*(?:[^*]|\*(?!\/))*\*\/\s*\}/g

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

/**
 * ⭐⭐ OS HEX DE COR CRAVADOS NUMA TELA — um detector, um lugar (14/10/2026).
 *
 * ⚠️ Nasceu porque a cláusula *"zero hex cravado em tela"* da fundação vale pro SISTEMA TODO, e
 * até aqui cada guard de tela escrevia o próprio regex de hex (`margem-v3`, `pagina-da-ordem-v4`,
 * `custos-fixos-v4`, `home-producao-mock-v3`…). ***N cópias do mesmo detector divergem, e a que
 * diverge é sempre a que ninguém reconsertou*** — foi exatamente assim que o `semComentarios`
 * ficou cego em 08/10 e cegou TODO guard de uma vez.
 *
 * ⛔ Lê SEM COMENTÁRIO de propósito: metade dos hex que aparecem num `grep` cru desta casa vive
 * em comentário DOCUMENTANDO o tom que saiu (o `dashboard-shell` é o caso puro — os 3 hex dele
 * são a história do canvas, não CSS). Contar comentário faria o arquivo que explica o defeito
 * ser reprovado por explicá-lo.
 *
 * ⚠️ O `[^0-9a-zA-Z_#]` antes do `#` evita casar dentro de um token maior; os 8 dígitos cobrem
 * `#RRGGBBAA`, que o Tailwind aceita em valor arbitrário.
 */
export function hexCravados(src: string): string[] {
  const limpo = semComentarios(src)
  return [...limpo.matchAll(/(?:^|[^0-9a-zA-Z_#])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/g)].map(
    (m) => m[1].toLowerCase(),
  )
}

/** ⭐ o corpo de um bloco entre dois marcos — pra asserção ESTRUTURAL, não por distância */
export function blocoEntre(src: string, inicio: string, fim: string): string {
  const i = src.indexOf(inicio)
  if (i < 0) return ''
  const j = src.indexOf(fim, i + inicio.length)
  return j < 0 ? src.slice(i) : src.slice(i, j + fim.length)
}

/**
 * ⭐⭐ A VARREDURA DAS TELAS — **um lugar** (14/10/2026). Todo `.tsx` de `app/` e `components/`,
 * ordenado.
 *
 * ⚠️ Nasceu de `zero-hex-cravado`, onde ela era uma função local. Com a varredura WCAG da
 * fundação precisando do MESMO universo, copiá-la seria a 2ª cópia do mesmo detector — e é
 * exatamente assim que uma das duas fica cega (o cabeçalho deste arquivo conta a vez em que
 * isso custou um guard verde com o defeito reposto).
 */
export function telasDoApp(raiz = process.cwd()): string[] {
  const varrer = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(join(raiz, dir))) {
      const p = `${dir}/${e}`
      if (statSync(join(raiz, p)).isDirectory()) varrer(p, out)
      else if (e.endsWith('.tsx')) out.push(p)
    }
    return out
  }
  return [...varrer('app'), ...varrer('components')].sort()
}
