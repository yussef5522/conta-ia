// ⭐ OS 16 PINOS DA LEI (docs/contagem-referencia.html) portados pra lib — e o guard ABRE a lei:
// todo pino que a referência declara tem que existir aqui com o MESMO nome (ARQUIVO DE REFERÊNCIA = LEI).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import {
  venceHoje, ordemDoDia, duplaUn, rotConfirmar, acur, nuncaBate, sparkPath, liquido, mexido, contaDaCaixa,
} from '../direcao'

const SALDO14 = [34, 31, 28, 25, 23, 35, 32, 29, 26, 24, 22, 34, 30, 27]
const AJUSTES = [-22.62, -19.19, 4.61]

const PINOS: Record<string, () => boolean> = {
  'A todo dia: 1 dia vence hoje': () => venceHoje('A', 1) === true,
  'A contado hoje não vence': () => venceHoje('A', 0) === false,
  'nunca contado entra na lista': () => venceHoje('C', null) === true,
  'atrasado vem primeiro': () => ordemDoDia([{ g: 'A' as const, d: 2 }, { g: 'B' as const, d: 9 }])[0].g === 'B',
  '1 cx + 2,4 com fator 12 = 14,4': () => duplaUn('1 cx + 2,4', 12) === 14.4,
  '2 cx + 7 com fator 24 = 55': () => duplaUn('2 cx + 7', 24) === 55,
  'só número continua valendo': () => duplaUn('13', 24) === 13,
  'total vai escrito no botão': () => rotConfirmar(14.4, 'KG') === 'Confirmar 14,4 KG',
  'acuracidade 165/180 = 92': () => acur(165, 180) === 92,
  'sessão 14/18 = 78': () => acur(14, 18) === 78,
  '0 de 30 é nunca-bate': () => nuncaBate(0, 30) === true,
  '27 de 29 não é': () => nuncaBate(27, 29) === false,
  '2 contagens não julgam': () => nuncaBate(0, 2) === false,
  'caminho do saldo é desenhável': () => sparkPath(SALDO14, 316, 52).startsWith('M'),
  'líquido dos ajustes = −37,20': () => liquido(AJUSTES) === -37.2,
  'mexido dos ajustes = 46,42': () => mexido(AJUSTES) === 46.42,
}

const LEI = readFileSync(join(process.cwd(), 'docs/contagem-referencia.html'), 'utf8')

describe('a lei é a v3 aprovada', () => {
  it('título exato', () => {
    expect(LEI).toContain('<title>CONTAGEM COM DIREÇÃO (estoque) — referência v3 APROVADA</title>')
  })
  it('a própria lei roda verde em node (os pinos dela passam)', () => {
    const scripts = [...LEI.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    const ultimo = scripts[scripts.length - 1][1]
    const logs: string[] = []
    runInNewContext(ultimo, { console: { log: (s: string) => logs.push(s) } })
    expect(logs[0]).toBe('PINOS OK — 16 verdes')
  })
})

describe('os 16 pinos portados — mesmos nomes da lei', () => {
  const nomesDaLei = [...LEI.matchAll(/^\s*\['([^']+)',/gm)].map((m) => m[1])
  it('a lei declara 16 pinos e todos estão portados', () => {
    expect(nomesDaLei).toHaveLength(16)
    expect(Object.keys(PINOS).sort()).toEqual([...nomesDaLei].sort())
  })
  for (const [nome, pino] of Object.entries(PINOS)) it(nome, () => expect(pino()).toBe(true))
})

describe('R38 — número puro; caixa só com fator', () => {
  it('"cx" sem fator cadastrado é recusado', () => {
    expect(duplaUn('1 cx', null)).toBeNull()
    expect(duplaUn('2,4', null)).toBe(2.4)
  })
  it('digitou só número → nada de conta de caixa na tela', () => {
    expect(contaDaCaixa('22,4', 12, 'KG')).toBe('')
    expect(contaDaCaixa('1 cx + 2,4', 12, 'KG')).toBe('= 14,4 KG · caixa ×12 + solto')
  })
  it('acuracidade sem contagem é ausência, não 0%', () => expect(acur(0, 0)).toBeNull())
})
