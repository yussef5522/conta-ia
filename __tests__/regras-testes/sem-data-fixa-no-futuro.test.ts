// ⛔⛔⛔ DATA FIXA NO FUTURO É UMA CONTAGEM REGRESSIVA (01/09/2026).
//
// QUATRO OCORRÊNCIAS, e a última explodiu com três testes de uma vez:
//   · 26/08 — a rota de detecção de pagamento de empréstimo tinha janela FIXA
//     `01/07–31/08`: em 01/09 pararia de funcionar **em silêncio**, sem erro nenhum.
//   · 01/09 — `real-vs-teorico` fixava `ATE = '2026-08-31'`. O `AJUSTE_CONTAGEM` é
//     carimbado com AGORA (correto: em produção o ajuste acontece no instante da
//     contagem), então o teste dependia de "hoje" estar dentro da janela. Passou agosto
//     inteiro; virou o dia e **5 testes ficaram vermelhos sozinhos**.
//   · 01/09 — `producao P2` fingia `now = new Date('2026-09-01')` com o comentário "11
//     dias depois". Mas P2 mede `now − atualizadoEm`, e `atualizadoEm` é o relógio REAL.
//     No dia 01/09 a diferença virou **zero**.
//   · 01/09 — `producao P5/P6` fingia `'2026-09-30'`. Ainda não tinha explodido —
//     explodiria em 30/09. Desarmada antes de tocar.
//
// ⭐ A RÉGUA: **"futuro" tem que ser relativo ao relógio de quem roda. Data fixa não é
// futuro — é uma data que o calendário alcança.** Quando o teste precisa de um "agora"
// adiante, o certo é `new Date(Date.now() + N * 86_400_000)`.
//
// ⚠️ E A MEDIDA MOSTRA POR QUE A REGRA É ESTREITA: a suíte tem **148** datas fixas no
// futuro, e a esmagadora maioria é FIXTURE legítima (`dVenc`, `dueDate`, `validadeAte`) —
// um boleto que vence em 19/09 é dado realista, e virar passado não quebra nada, porque o
// teste não compara com o relógio. O que mata é a data fixa ocupando a posição de AGORA.
//
// ⚠️ ISTO É UM LINT, NÃO UM TESTE DE COMPORTAMENTO — e a distinção importa pra REGRA 3.
// Ele não afirma que alguma função funciona; ele impede uma classe de ERRO DE ESCRITA de
// entrar no repositório. É a mesma natureza do guard de `perm` na sidebar e do de hooks
// antes do early-return.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const DATA = String.raw`['"\`](\d{4}-\d{2}-\d{2})[^'"\`]*['"\`]`

/**
 * Os jeitos de uma data fixa ocupar a posição de "agora".
 * ⚠️ Padrão novo aqui = classe nova coberta. Se um caso escapar, é aqui que ele entra.
 */
const POSICOES_DE_RELOGIO = [
  { nome: 'argumento nomeado now/agora/hoje/ate', re: new RegExp(String.raw`\b(now|agora|hoje|ate)\s*[:=]\s*new Date\(\s*` + DATA) },
  { nome: 'const ATE/NOW/AGORA/HOJE = data fixa', re: new RegExp(String.raw`\b(ATE|NOW|AGORA|HOJE)\s*=\s*(new Date\(\s*)?` + DATA) },
  { nome: 'último argumento de check*Invariants', re: new RegExp(String.raw`check\w*Invariants\([^)]*new Date\(\s*` + DATA) },
]

/**
 * ⚠️⚠️ A INDIREÇÃO PRECISA SER RESOLVIDA, e eu descobri isso do jeito ruim: a 1ª versão
 * deste guard NÃO pegou a bomba do P2, porque ela estava em
 *     `const daquiA11Dias = new Date('2027-09-01')`  →  `checkProducaoInvariants(prisma, daquiA11Dias)`
 * e meus padrões só olhavam nomes tipo `now`/`ATE`. Guard que não pega o caso que motivou
 * o guard é pior que nenhum: dá selo verde de graça.
 *
 * ⛔ E POR QUE NÃO BASTA FLAGRAR **toda** `const X = new Date(futuro)`: medido na suíte,
 * isso dá 3 achados e os TRÊS são benignos —
 *   · `certificate.test`: `NOT_AFTER` é a validade de um .pfx sintético, e `readPfx` não
 *     tem `new Date()` em lugar nenhum (não compara com relógio);
 *   · `access.test`: `futureNow` e `FUTURE` são ambas fixas e coerentes entre si;
 *   · `sprint-date-filter-A`: `dez` alimenta função pura de intervalo.
 * Três alarmes falsos no dia 1 é como um alarme morre. **O que distingue bomba de fixture
 * é semântico** — a data fixa ser comparada com um carimbo do relógio REAL — e isso não
 * dá pra ler no texto. Por isso o guard cobre a POSIÇÃO DE RELÓGIO, com a indireção
 * resolvida, e assume não cobrir o resto.
 */
function constantesDeData(fonte: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of fonte.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*new Date\(\s*['"`](\d{4}-\d{2}-\d{2})[^'"`]*['"`]/g)) {
    out.set(m[1], m[2])
  }
  return out
}

/** a mesma posição de relógio, mas com um IDENTIFICADOR no lugar do literal */
const POSICOES_COM_IDENTIFICADOR = [
  { nome: 'check*Invariants(…, <const de data>)', re: /check\w*Invariants\([^)]*?,\s*(\w+)\s*\)/ },
  { nome: 'now/agora/hoje/ate: <const de data>', re: /\b(?:now|agora|hoje|ate)\s*[:=]\s*(\w+)\s*[,)]/ },
]

interface Achado { arquivo: string; linha: number; iso: string; padrao: string; texto: string }

function varrer(): Achado[] {
  const arqs = execSync(
    "find . -path ./node_modules -prune -o \\( -name '*.test.ts' -o -name '*.test.tsx' \\) -print",
    { encoding: 'utf-8', cwd: process.cwd() },
  ).trim().split('\n').filter(Boolean)
    // ⚠️ o próprio guard contém EXEMPLOS deliberados da bomba (o auto-teste do detector).
    // Sem esta linha ele se acusa — e um guard que só acusa a si mesmo é ruído puro.
    .filter((a) => !a.endsWith('sem-data-fixa-no-futuro.test.ts'))

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const out: Achado[] = []

  for (const arq of arqs) {
    const fonte = readFileSync(arq, 'utf-8')
    const consts = constantesDeData(fonte)
    fonte.split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l)) return // comentário não é código
      const marcar = (iso: string, padrao: string) => {
        if (new Date(`${iso}T00:00:00`) > hoje) {
          out.push({ arquivo: arq.replace('./', ''), linha: i + 1, iso, padrao, texto: l.trim().slice(0, 90) })
        }
      }
      for (const p of POSICOES_DE_RELOGIO) {
        const m = p.re.exec(l)
        if (m) { marcar(m[m.length - 1], p.nome); return }
      }
      // ⭐ a indireção: o literal está numa `const` e o que aparece aqui é o NOME dela
      for (const p of POSICOES_COM_IDENTIFICADOR) {
        const m = p.re.exec(l)
        if (!m) continue
        const iso = consts.get(m[1])
        if (iso) { marcar(iso, p.nome); return }
      }
    })
  }
  return out
}

describe('⛔⛔ nenhum teste pode fingir um "agora" com data FIXA no futuro', () => {
  it('⛔⛔ a suíte inteira está limpa — data fixa em posição de relógio só no PASSADO', () => {
    const violacoes = varrer()
    const relato = violacoes
      .map((v) => `\n  ${v.arquivo}:${v.linha}  [${v.padrao}]  ${v.iso}\n      ${v.texto}`)
      .join('')
    expect(
      violacoes,
      `${violacoes.length} data(s) fixa(s) NO FUTURO ocupando posição de "agora".` +
      `\nIsso é uma contagem regressiva: passa hoje e quebra sozinho quando o calendário chegar lá.` +
      `\nUse \`new Date(Date.now() + N * 86_400_000)\` — "futuro" tem que ser relativo ao relógio de quem roda.${relato}\n`,
    ).toEqual([])
  })

  it('⭐ e o detector PEGA o padrão (senão o guard passaria por cegueira)', () => {
    // ⚠️ sem isto, um regex quebrado deixaria o guard verde pra sempre — foi o que quase
    // aconteceu com o guard de hooks (25/08), que precisou do mesmo teste de si mesmo.
    const daquiA10Anos = new Date(Date.now() + 3650 * 86_400_000).toISOString().slice(0, 10)
    const casos = [
      `const p = soP(await checkProducaoInvariants(prisma, new Date('${daquiA10Anos}')))`,
      `const ATE = '${daquiA10Anos}'`,
      `calcular({ companyId, ate: new Date('${daquiA10Anos}') })`,
      `  now: new Date('${daquiA10Anos}'),`,
    ]
    for (const c of casos) {
      const pegou = POSICOES_DE_RELOGIO.some((p) => p.re.test(c))
      expect(pegou, `o detector não pegou: ${c}`).toBe(true)
    }

    // ⛔ E O CASO QUE ESCAPOU DA 1ª VERSÃO — a bomba REAL do P2, com indireção
    const consts = constantesDeData(`const daquiA11Dias = new Date('${daquiA10Anos}')`)
    expect(consts.get('daquiA11Dias')).toBe(daquiA10Anos)
    expect(
      POSICOES_COM_IDENTIFICADOR.some((p) => p.re.exec('const p = soP(await checkProducaoInvariants(prisma, daquiA11Dias))')?.[1] === 'daquiA11Dias'),
      'o detector não pega a indireção — foi assim que a bomba do P2 passou',
    ).toBe(true)
  })

  it('⚠️ e NÃO pega fixture legítima — dVenc/dueDate no futuro é dado realista', () => {
    // a suíte tem ~148 datas futuras que são DADO (boleto que vence, validade de etiqueta).
    // Virar passado não quebra nada: o teste não compara com o relógio.
    const legitimas = [
      `{ nDup: '001', vDup: 3466.88, dVenc: new Date('2099-09-10T00:00:00.000Z') },`,
      `{ valor: 570.0, dVenc: '2099-09-19T00:00:00.000Z' },`,
      `validadeAte: new Date('2099-09-14T14:35:00'),`,
      `{ number: 59, dueDate: '2099-09-26', payment: 2429.25 },`,
    ]
    for (const c of legitimas) {
      const pegou = POSICOES_DE_RELOGIO.some((p) => p.re.test(c))
      expect(pegou, `falso positivo em fixture legítima: ${c}`).toBe(false)
    }
  })
})
