// ⭐⭐ OS PINOS DAS 4 LEIS RODAM CONTRA A LIB (13/11/2026).
//
// ⛔ ARQUIVO DE REFERÊNCIA = LEI: o teste ABRE cada referência em docs/, tira do último <script> as
// definições das funções portadas e roda O PRÓPRIO bloco de PINOS da lei com as funções de
// `lib/stock/producao/leis-r.ts` no lugar. Pino que a lei escreveu e a lib não cumpre = vermelho.
// Nenhum pino é recopiado à mão aqui (cópia diverge da lei no primeiro ajuste do dono).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import * as L from '../leis-r'
import * as R from '../rotinas'

// 'rotinas' mora em docs/rotinas-referencia.html (lei R25–R31); as outras em docs/producao-<n>-referencia.html
const LEI = (n: string) =>
  readFileSync(join(process.cwd(), 'docs', n === 'rotinas' ? 'rotinas-referencia.html' : `producao-${n}-referencia.html`), 'utf8')

/** o último <script> da lei */
function scriptDaLei(html: string): string {
  // ⚠️ comentário HTML fora: a lei das Rotinas escreve "Pinos no <script>" no próprio comentário
  const blocos = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  expect(blocos.length).toBeGreaterThan(0)
  return blocos[blocos.length - 1][1]
}

/** remove `function NOME(...){...}` (casando chaves) e `const NOME = ...;` de uma linha */
function semDefinicao(src: string, nome: string): string {
  const fn = new RegExp(`function\\s+${nome}\\s*\\(`)
  const m = fn.exec(src)
  if (m) {
    let i = src.indexOf('{', m.index), prof = 0
    for (; i < src.length; i++) {
      if (src[i] === '{') prof++
      else if (src[i] === '}' && --prof === 0) break
    }
    return src.slice(0, m.index) + src.slice(i + 1)
  }
  const c = new RegExp(`^const\\s+${nome}\\s*=.*$`, 'm')
  if (c.test(src)) return src.replace(c, '')
  throw new Error(`a lei não define ${nome} — a lista de portadas está errada`)
}

function rodarPinos(lei: string, portadas: Record<string, unknown>, ponte = ''): { nome: string; ok: boolean }[] {
  let src = scriptDaLei(LEI(lei))
  for (const nome of Object.keys(portadas)) src = semDefinicao(src, nome)
  const ctx = vm.createContext({ console: { log() {} }, ...Object.fromEntries(Object.entries(portadas).map(([k, v]) => [`__${k}`, v])) })
  // as funções da LIB entram com o nome da lei (ponte = adaptadores de assinatura)
  vm.runInContext(Object.keys(portadas).map((k) => `var ${k} = __${k};`).join('\n') + ponte, ctx)
  // ⚠️ a lei lança "PINO FALHOU" no primeiro pino vermelho — captura pra listar TODOS
  const semThrow = src.replace(/for\s*\(const \[nome,ok\] of PINOS\)[^\n]*\n/, '')
  vm.runInContext(semThrow, ctx)
  return vm.runInContext('PINOS.map(([nome, ok]) => ({ nome, ok: !!ok }))', ctx)
}

const casos: [string, () => { nome: string; ok: boolean }[], number][] = [
  ['AO VIVO v3', () => rodarPinos('ao-vivo', { mediana: L.mediana, corDoTempo: L.corDoTempo, fmtDur: L.fmtDur, posPulso: L.posPulso },
    // posPulso da lei usa o eixo da amostra (PULSO_INI/PULSO_FIM); a lib recebe o eixo por parâmetro
    '\nvar posPulso = function(h){ return __posPulso(h, PULSO_INI, PULSO_FIM) };'), 13],
  ['DESEMPENHO v2', () => rodarPinos('desempenho', {
    barPct: L.barPct, ritmo: L.ritmo, rendCor: L.rendCor, custoFlag: L.custoFlag,
    rotuloPeriodo: L.rotuloPeriodo, fmtH: L.fmtH, fmtDur: L.fmtDur, fmtQ: L.fmtQ, brl2: L.brl2,
  }), 17],
  ['RECEITAS v2', () => rodarPinos('receitas', {
    custoParcial: L.custoParcial, rotCusto: L.rotCusto, fmtVal: L.fmtVal, brl2: L.brl2, destinoExclusao: L.destinoExclusaoReceita,
  }), 11],
  ['EQUIPE v2', () => rodarPinos('equipe', {
    validaPin: L.validaPin, foraDoRanking: L.foraDoRanking, destinoExclusao: L.destinoExclusaoConta, textoExcluir: L.textoExcluir,
  }), 10],
  ['ROTINAS v1', () => rodarPinos('rotinas', {
    semeiaHoje: R.semeiaHoje, semear: R.semear, proxima: R.proxima, atrasada: R.atrasada,
    grupoConcluido: R.grupoConcluido, progresso: R.progresso,
  }), 12],
]

describe('os pinos das leis R rodam contra lib/stock/producao/leis-r.ts', () => {
  it.each(casos)('%s — todos os pinos verdes', (_nome, rodar, total) => {
    const r = rodar()
    expect(r.length).toBe(total)
    expect(r.filter((p) => !p.ok).map((p) => p.nome)).toEqual([])
  })

  it('a ponte do posPulso é a função da lib (não a da lei)', () => {
    // prova de que a substituição aconteceu: a definição da lei some do texto que roda
    const src = semDefinicao(scriptDaLei(LEI('ao-vivo')), 'posPulso')
    expect(src).not.toMatch(/function\s+posPulso/)
  })
})
