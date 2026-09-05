// ⛔⛔⛔ GUARD ESTRUTURAL — a ficha do banco é consultada por UMA função (05/09/2026).
//
// **Pedido do dono, depois da SEGUNDA ocorrência da mesma classe no mesmo perfil:**
// *"de preferência UMA função (podeConferirPorLedgerbal?) que todos chamam, em vez de N ifs."*
//
// Eram **6 leituras** de `ledgerBalReliable` espalhadas (orquestrador ×2, resolve-import-
// statuses, selo, classify-for-import, judge), cada uma com o seu `?? true`. O `ledgerBalMatched`
// foi corrigido em 01/09 e o `ledgerMismatch`, **35 linhas acima no mesmo arquivo**, ficou —
// e cobrou um dia de import parado.
//
// ⚠️ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL (a REGRA 3 pede comportamento; o
// comportamento está em `ledgerbal-um-dono-so.test.ts`, ao lado). O que ele impede é a
// PRÓXIMA cópia nascer: quem escrever `perfil.ledgerBalReliable` num lugar novo fica
// vermelho aqui e é mandado pra função.
//
// ⭐ E ELE TEM AUTO-TESTE: sem provar que o detector pega a linha proibida, um guard passa
// verde por cegueira — foi assim que três guards deste projeto nasceram mentindo.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')

/** onde o campo PODE aparecer, e por quê */
const PERMITIDOS = new Set([
  // o dono da pergunta
  'lib/bank-profiles/pode-conferir-por-ledgerbal.ts',
  // a ficha em si: é onde o campo é DECLARADO e PREENCHIDO por banco
  'lib/bank-profiles/registry.ts',
  'lib/bank-profiles/types.ts',
  // o juiz é PURO e recebe a resposta pronta por parâmetro (não resolve ficha)
  'lib/canonical/judge.ts',
  'lib/canonical/classify-for-import.ts',
])

function arquivosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next' || nome === '.git' || nome.startsWith('.next-build')) continue
    const p = join(dir, nome)
    const st = statSync(p)
    if (st.isDirectory()) arquivosDeCodigo(p, acc)
    else if (/\.tsx?$/.test(nome) && !p.includes('__tests__')) acc.push(p)
  }
  return acc
}

/** ⭐ a linha proibida: LER o campo da ficha em vez de perguntar pra função */
export function leDiretoAFicha(conteudo: string): boolean {
  // `.ledgerBalReliable` acessado como propriedade (não a declaração `ledgerBalReliable:`)
  return /\.\s*ledgerBalReliable/.test(conteudo)
}

describe('⛔ ninguém lê `ledgerBalReliable` na mão fora do dono da pergunta', () => {
  it('⛔⛔ nenhum arquivo novo consulta a ficha direto', () => {
    const infratores: string[] = []
    for (const abs of arquivosDeCodigo(join(RAIZ, 'lib')).concat(arquivosDeCodigo(join(RAIZ, 'app')))) {
      const rel = abs.slice(RAIZ.length + 1)
      if (PERMITIDOS.has(rel)) continue
      if (leDiretoAFicha(readFileSync(abs, 'utf8'))) infratores.push(rel)
    }
    expect(
      infratores,
      `estes leem a ficha na mão em vez de chamar podeConferirPorLedgerbal(): ${infratores.join(', ')}`,
    ).toEqual([])
  })

  it('⭐ AUTO-TESTE do detector — senão ele passaria verde por cegueira', () => {
    expect(leDiretoAFicha('const x = perfil?.ledgerBalReliable ?? true')).toBe(true)
    expect(leDiretoAFicha('if (bankProfile.ledgerBalReliable === false) {}')).toBe(true)
    expect(leDiretoAFicha('const x = perfil ?.  ledgerBalReliable')).toBe(true)
    // ⚠️ e NÃO morde a declaração do campo nem o texto de comentário
    expect(leDiretoAFicha('ledgerBalReliable: false,')).toBe(false)
    expect(leDiretoAFicha('// a ficha diz ledgerBalReliable false desde 29/08')).toBe(false)
  })

  it('⭐ e a função existe e é exportada pelo barrel (é o caminho que o guard manda seguir)', () => {
    const barrel = readFileSync(join(RAIZ, 'lib/bank-profiles/index.ts'), 'utf8')
    expect(barrel).toMatch(/podeConferirPorLedgerbal/)
    expect(barrel).toMatch(/avaliarFechamentoDeSaldo/)
  })
})
