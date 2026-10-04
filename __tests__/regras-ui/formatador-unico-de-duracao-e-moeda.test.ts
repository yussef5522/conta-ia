/**
 * ⛔⛔⛔ UM FORMATADOR DE DURAÇÃO, UM DE MOEDA — e nenhuma tela formata na mão (04/10/2026).
 *
 * **Pedido do dono, depois de ver o print:** *"formatar SEMPRE h/min redondos por formatador
 * único da casa; guard: tela com 3+ casas decimais em tempo = vermelho (é a família do round da
 * borda, REGRA 11)"* e *"moeda SEMPRE 2 casas pelo formatador de moeda da casa; varrer a tela
 * inteira por moeda fora do formatador"*.
 *
 * ⭐⭐ **POR QUE ESTRUTURAL, e não só o teste de comportamento:** `formatarDuracao` já tem teste
 * que prova que ele acerta. O que ele **não impede** é alguém (eu, em três meses, numa tela nova)
 * escrever `${Math.floor(m/60)}h${m % 60}` de novo — e o estrago é o do print: `3h21.830000000000013`
 * na cara do dono, com o `tsc` verde e a suíte verde. **Eram CINCO cópias dessa decisão**, e
 * três delas vazavam float. É a doença dos 7 detectores de par, em forma de hora.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (rel: string) => readFileSync(join(raiz, rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

function varrer(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(raiz, dir))) {
    if (e === 'node_modules' || e === '__tests__' || e.startsWith('.')) continue
    const rel = `${dir}/${e}`
    if (statSync(join(raiz, rel)).isDirectory()) varrer(rel, out)
    else if (/\.(ts|tsx)$/.test(e)) out.push(rel)
  }
  return out
}
const FONTES = [...varrer('app'), ...varrer('components'), ...varrer('lib')]

/**
 * ⭐ O DETECTOR: `X % 60` montando TEXTO de duração.
 *
 * ⚠️ A forma é `% 60` **dentro de um template** com `h` ou `min`/`:` por perto — não qualquer
 * `% 60` do código. Sem essa restrição ele acusaria o `--destructive: 0 84.2% 60.2%` do CSS e
 * contagem de segundos que não é duração — *alarme falso no dia 1 é como um guard morre*.
 */
function formataDuracaoNaMao(src: string): boolean {
  return /\$\{[^}]*%\s*60[^}]*\}\s*(?:h|min|:)|(?:h|min|:)\s*\$\{[^}]*%\s*60/.test(src)
    || /%\s*60\s*\)\s*\.padStart/.test(src)
}

/**
 * ⚠️ AS EXCEÇÕES, cada uma com o motivo — e são todas de OUTRA pergunta, não folga:
 * - `lib/format/duracao.ts` é o DONO da régua (é ele que faz o `% 60`, uma vez);
 * - `cronometro.ts` formata **mm:ss** de um cronômetro em SEGUNDOS (inteiro por construção);
 * - `esqueci-senha` é contagem regressiva em segundos, não duração de trabalho.
 */
const DONO = 'lib/format/duracao.ts'
const OUTRA_PERGUNTA = [
  'lib/stock/producao/cronometro.ts',
  'app/(auth)/esqueci-senha/esqueci-senha-client.tsx',
]

describe('⛔⛔ duração: um formatador, zero cópias', () => {
  it('⭐⭐ ninguém formata h/min na mão fora do dono da régua', () => {
    const culpados = FONTES
      .filter((f) => f !== DONO && !OUTRA_PERGUNTA.includes(f))
      .filter((f) => formataDuracaoNaMao(semComentario(ler(f))))
    expect(
      culpados,
      `formate com \`formatarDuracao\` de ${DONO} — \`m % 60\` com m decimal vaza float (201.83 % 60 = 21.830000000000013)`,
    ).toEqual([])
  })

  /**
   * ⛔⛔ AUTO-TESTE DO DETECTOR — sem ele o guard passaria por CEGUEIRA, que é como três guards
   * desta casa nasceram mentindo (o do seed do radar, o do `fetch*`, o do rastro).
   */
  it('⭐ o detector PEGA a forma antiga e NÃO acusa a nova', () => {
    // as 5 cópias reais que existiam, uma de cada arquivo
    expect(formataDuracaoNaMao('`${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`')).toBe(true)
    expect(formataDuracaoNaMao('`${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`')).toBe(true)
    expect(formataDuracaoNaMao('m >= 60 ? `${Math.floor(m/60)}h${m % 60}` : `${m}min`')).toBe(true)
    // ⭐ e NÃO acusa o que não é duração
    expect(formataDuracaoNaMao('const s = codeRemaining % 60')).toBe(false)
    expect(formataDuracaoNaMao('--destructive: 0 84.2% 60.2%;')).toBe(false)
    expect(formataDuracaoNaMao('const x = formatarDuracao(m)')).toBe(false)
  })

  it('⭐ as 5 telas que tinham cópia agora CHAMAM o formatador', () => {
    const consumidores = [
      'app/(dashboard)/empresas/[id]/estoque/producao/por-dia/page.tsx',
      'app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx',
      'app/(dashboard)/empresas/[id]/estoque/producao/relatorios/page.tsx',
      'components/estoque/etapas-da-ordem.tsx',
      'lib/stock/producao/desempenho.ts',
    ]
    for (const f of consumidores) {
      expect(semComentario(ler(f)), `${f} tem que importar formatarDuracao`).toMatch(/formatarDuracao/)
    }
  })
})

/**
 * ⛔⛔ MOEDA: o `R$` só sai do formatador.
 *
 * **O defeito do print:** `R$ ${num(x)}` onde `num` é de QUANTIDADE
 * (`toLocaleString({ maximumFractionDigits: 2 })`) → `638.5` virava **"R$ 638,5"**, centavo
 * truncado. ⚠️ `maximumFractionDigits` SEM `minimum` nunca garante 2 casas; `formatBRL` usa
 * `style: 'currency'`, que garante por contrato.
 */
describe('⛔ moeda: 2 casas pelo formatador, no módulo de produção', () => {
  const MODULO = FONTES.filter((f) =>
    f.includes('estoque/producao') || f.includes('components/estoque') || f.includes('lib/stock/producao'),
  )

  it('⭐⭐ nenhum `R$ ${…}` montado à mão — nem com toLocaleString, nem com toFixed', () => {
    const culpados: string[] = []
    for (const f of MODULO) {
      const src = semComentario(ler(f))
      // `R$ ${...}` onde o conteúdo NÃO é o formatador da casa
      for (const m of src.matchAll(/R\$\s*\$\{([^}]*)\}/g)) {
        if (!/formatBRL|formatBRLCompact/.test(m[1])) culpados.push(`${f}: R$ \${${m[1]}}`)
      }
    }
    expect(culpados, 'moeda sai do `formatBRL` (que já traz o R$ — a cicatriz do "R$ R$")').toEqual([])
  })

  it('⭐ o detector PEGA o defeito real do print e NÃO acusa o formatador', () => {
    const pega = (src: string) =>
      [...src.matchAll(/R\$\s*\$\{([^}]*)\}/g)].some((m) => !/formatBRL/.test(m[1]))
    expect(pega('` · R$ ${num(e.loteFechado.custoUnitario)}/un`'), 'o defeito de 04/10').toBe(true)
    expect(pega('`R$ ${v.toFixed(2)}`')).toBe(true)
    expect(pega('` · ${formatBRL(e.loteFechado.custoUnitario)}/un`'), 'o conserto').toBe(false)
  })
})
