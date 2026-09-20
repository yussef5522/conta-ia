// ⭐⭐⭐ DOIS ARQUIVOS DE TESTE NÃO PODEM DIVIDIR O MESMO CNPJ (20/09/2026).
//
// ⛔⛔ **ISTO NÃO É ESTILO — É A CAUSA DE UM FLAKE QUE FICOU VIGIADO POR DIAS.** Em 20/09 o
// `resolvido-de-um-lado-some-do-outro` ficou vermelho *"1× em 4 rodadas"* e eu **não
// consegui nomear a causa**; registrei como vigiado, sem rotular de pré-existente (a régua:
// *"'pré-existente' só depois de MEDIR a causa"*). A causa, medida hoje:
//
//   dois arquivos usavam `const CNPJ = '50607080000616'`, e **os dois** fazem
//   `company.deleteMany({ where: { cnpj } })` no `beforeEach`.
//
// A suíte roda os arquivos **em PARALELO contra o mesmo banco**: um apaga a empresa do
// outro no meio do setup, o cascade leva `bankAccount`/`category`/`supplier` junto, e o
// `transaction.create` seguinte morre com FK inválida. O vermelho **muda de arquivo a cada
// rodada** e não é de ninguém — exatamente a assinatura do `afterEach` sem escopo de
// empresa (20/09) e do `snapshotClosedModules` global (23/08). **Terceira vez.**
//
// ⭐ **REGRA 5 — disciplina vira impossibilidade:** em vez de "lembrar de escolher um CNPJ
// novo", o guard recusa a colisão. Quando ele reprovar, é só mudar um dígito.
//
// ⚠️ **ELE SÓ OLHA QUEM MEXE EM `company`**: `format-cnpj`, `cpf-cnpj` e os parsers usam
// CNPJ como DADO, não como chave de empresa no banco — alarme ali seria ruído no dia 1, e
// *alarme falso é como um guard morre*.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()

function arquivosDeTeste(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next' || nome === '.git') continue
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) arquivosDeTeste(p, out)
    else if (nome.endsWith('.test.ts') || nome.endsWith('.test.tsx')) out.push(p)
  }
  return out
}

/**
 * ⭐ Só conta o CNPJ que **decide a empresa** — o que aparece dentro de um
 * `company.create/deleteMany/upsert`.
 *
 * ⚠️⚠️ A 1ª versão pegava QUALQUER literal de 14 dígitos do arquivo e acusou **CNPJ de
 * FORNECEDOR** (o `36603841000130` da CIA DA FRUTA, que é dado real de dois testes e não
 * disputa empresa nenhuma) — e até o literal do meu próprio auto-teste. *Alarme falso no
 * dia 1 é como um guard morre*, então ele ficou estreito: resolve a indireção
 * (`const CNPJ = '…'` → `cnpj: CNPJ`) e olha só dentro da chamada que mexe em `company`.
 */
function cnpjsQueViramEmpresa(src: string): string[] {
  const limpo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  if (!/company\.(create|deleteMany|upsert)/.test(limpo)) return []

  // 1. as constantes do arquivo que guardam um CNPJ
  const porNome = new Map<string, string>()
  for (const m of limpo.matchAll(/(?:const|let)\s+(\w+)\s*=\s*['"`](\d{14})['"`]/g)) {
    porNome.set(m[1]!, m[2]!)
  }

  // 2. o `cnpj:` que aparece DENTRO de uma chamada a company.*
  const achados = new Set<string>()
  for (const chamada of limpo.matchAll(/company\.(?:create|deleteMany|upsert)\(([\s\S]{0,400}?)\)\s*[,;)\n]/g)) {
    for (const c of chamada[1]!.matchAll(/cnpj:\s*(?:['"`](\d{14})['"`]|(\w+))/g)) {
      const valor = c[1] ?? porNome.get(c[2] ?? '')
      if (valor) achados.add(valor)
    }
  }
  return [...achados]
}

describe('⛔⛔ CNPJ de teste é único por arquivo — senão os testes se derrubam em paralelo', () => {
  const porCnpj = new Map<string, string[]>()
  for (const arq of [...arquivosDeTeste(join(raiz, 'lib')), ...arquivosDeTeste(join(raiz, '__tests__'))]) {
    // ⚠️ o próprio guard usa literais de exemplo — auto-referência não é colisão
    if (arq.endsWith('cnpj-de-teste-nao-colide.test.ts')) continue
    for (const c of cnpjsQueViramEmpresa(readFileSync(arq, 'utf-8'))) {
      porCnpj.set(c, [...(porCnpj.get(c) ?? []), arq.replace(raiz + '/', '')])
    }
  }

  it('⭐ nenhum CNPJ é criado/apagado por dois arquivos diferentes', () => {
    const colisoes = [...porCnpj.entries()]
      .filter(([, arqs]) => arqs.length > 1)
      .map(([c, arqs]) => `${c} → ${arqs.join(' · ')}`)
    expect(
      colisoes,
      'dois arquivos disputam a MESMA empresa: em paralelo um apaga o setup do outro '
      + '(cascade em bankAccount/category/supplier) e o vermelho vira loteria. '
      + 'Troque um dígito do CNPJ de um dos lados:\n' + colisoes.join('\n'),
    ).toEqual([])
  })

  it('⭐ e o detector enxerga o padrão — senão ele passaria por cegueira', () => {
    // ⚠️ auto-teste: sem isto o guard poderia estar lendo zero arquivo e "aprovando" tudo
    // (já aconteceu três vezes nesta casa com detector de regex frouxo).
    expect(porCnpj.size, 'o detector não achou CNPJ nenhum — ele está cego').toBeGreaterThan(10)
    // ⭐ resolve a indireção da constante
    expect(cnpjsQueViramEmpresa(
      "const CNPJ = '12345678000155'\nawait prisma.company.deleteMany({ where: { cnpj: CNPJ } });",
    )).toEqual(['12345678000155'])
    // ⭐ e o literal inline
    expect(cnpjsQueViramEmpresa(
      "await prisma.company.create({ data: { cnpj: '12345678000155', name: 'X' } });",
    )).toEqual(['12345678000155'])
    // ⛔ NÃO morde quem só usa CNPJ como dado…
    expect(cnpjsQueViramEmpresa("expect(formatCnpj('12345678000155')).toBe('…')")).toEqual([])
    // ⛔ …nem CNPJ de FORNECEDOR num arquivo que também mexe em company
    expect(cnpjsQueViramEmpresa(
      "const FORN = '36603841000130'\nawait prisma.company.create({ data: { cnpj: '99999999000199' } });\n"
      + "await prisma.supplier.create({ data: { cnpj: FORN } });",
    )).toEqual(['99999999000199'])
  })
})
