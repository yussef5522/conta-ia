/**
 * ⭐⭐⭐ O LEITOR DAS REFERÊNCIAS VISUAIS — uma régua, N arquivos, N leitores (08/10/2026).
 *
 * Um arquivo em `docs/*-referencia.html` é a LEI VISUAL de uma tela, e **duas coisas leem cada
 * um**: o guard (`__tests__/regras-ui/*-bate-com-a-referencia.test.ts`) e a sonda da prova em
 * prod. ⚠️ Mudou de casa em 08/10 (`lib/margem/referencia.ts` → aqui) quando a **segunda**
 * referência nasceu (a central de import): escrever um leitor por tela repetiria, com outro
 * nome, exatamente a doença que o cabeçalho abaixo descreve.
 *
 * ⛔⛔ ESTE ARQUIVO NASCEU DE UM VERMELHO REAL. Na v3.1 o guard e a sonda extraíam as medidas
 * com **duas cópias do mesmo regex**; eu consertei a do guard (pra separar BREAKPOINT de
 * medida de ELEMENTO) e **deixei a da sonda atrás** — e a prova em prod acusou *"FALTAM 1024"*
 * sobre uma tela correta. ***É a doença que esta casa mais paga, agora entre o teste e a
 * prova:*** se as duas lêem o arquivo com réguas diferentes, uma delas mente, e a que mente é
 * sempre a que ninguém reconsertou.
 *
 * ⚠️ Lê do disco (`fs`), então é SERVIDOR/teste — nunca importado por código de tela.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** ⚠️ a referência da margem continua acessível pelo nome antigo — os 2 leitores dela não mudam */
export const CAMINHO_DA_REFERENCIA = 'docs/margem-referencia.html'
export const CAMINHO_DA_REFERENCIA_IMPORTAR = 'docs/importar-referencia.html'

export interface ReferenciaVisual {
  /** o arquivo inteiro */
  html: string
  /** só o `<style>` */
  css: string
  /** ⚠️ o `<script>` É a especificação do comportamento do montador */
  script: string
  /** os tokens do `:root{}` (antes do 1º `@media`), na ordem do arquivo */
  tokens: string[]
  /** as hierarquias de letra declaradas (`font-size:Npx`) */
  letras: string[]
  /** as medidas de ELEMENTO (`width`/`height`/`min-width`) */
  medidas: string[]
  /** os BREAKPOINTS (`@media (min|max-width:Npx)`) */
  cortes: string[]
}

/**
 * ⚠️ O CAMINHO É PARÂMETRO, com o da margem como default — assim os 2 leitores que já
 * existiam seguem chamando `lerReferenciaVisual()` sem mudar uma linha, e a referência nova
 * entra passando o caminho dela. ⛔ Um 2º arquivo de leitor é que seria a segunda régua.
 */
export function lerReferenciaVisual(
  caminho: string = CAMINHO_DA_REFERENCIA,
  raiz = process.cwd(),
): ReferenciaVisual {
  const html = readFileSync(resolve(raiz, caminho), 'utf8')
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
  const script = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'))

  const topo = css.slice(0, css.indexOf('@media'))
  const tokens = [...topo.matchAll(/(--[a-z0-9-]+):\s*#[0-9A-Fa-f]{3,8}/g)].map((m) => m[1])

  const unico = (xs: string[]) => [...new Set(xs)]
  const letras = unico([...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => m[1]))

  /**
   * ⚠️ O `[^-a-z(]` NÃO é preciosismo de regex, e é a razão de este arquivo existir:
   *  · sem excluir o `-`, o `max-width:1440px` do container entraria como largura de elemento;
   *  · sem excluir o `(`, o `min-width:1024px` do `@media` entraria também — e aí a régua
   *    cobraria um `[1024px]` literal numa tela que expressa aquele corte como `lg:`, o alias
   *    do Tailwind. **Breakpoint e medida de elemento são duas coisas**, e cada uma tem o seu
   *    leitor abaixo.
   */
  const medidas = unico(
    [...css.matchAll(/(?:^|[^-a-z(])(?:width|height|min-width):\s*([\d.]+)px/g)].map((m) => m[1]),
  )
  const cortes = unico(
    [...css.matchAll(/@media\s*\((?:min|max)-width:\s*([\d.]+)px\)/g)].map((m) => m[1]),
  )

  return { html, css, script, tokens, letras, medidas, cortes }
}
