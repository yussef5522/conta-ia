// ⛔⛔⛔ IMPORT MISTO — UMA CHAVE DE PARTIÇÃO: O `contentHash` (17/09/2026)
//
// **O dono, na fatura Sicredi:** *"40 linhas, 8 já no sistema (R$ 828,50), 32 novas marcadas
// (R$ 2.365,85). Confirmar → 'não fecha, diferença 828,50' — a diferença é EXATAMENTE as 8
// que a própria tela impediu de marcar."*
//
// ⛔⛔ **E A MINHA PRIMEIRA CORREÇÃO TROUXE A SEGUNDA RÉGUA DENTRO DELA.** A tela pergunta
// *"esta linha já está no sistema?"* pelo **hash** — a linha é conhecida **onde quer que ela
// more**. Eu fui buscar as gravadas **pela competência da fatura**, e as 8 do caso real são
// **parcelas que moram em faturas de jun/jul/ago**: em `2026-09` a busca achou **zero** e o
// fechamento voltou a cobrar as novas sozinhas, com a mesma diferença de 828,50.
//
// ⭐ *Duas chaves de partição são duas réguas.* A pergunta tem UMA resposta: o hash existe no
// banco, ponto — sem competência, sem data, sem o mês de qual fatura.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fecharImport, type LinhaEnviada } from '@/lib/credit-card-pj/fechamento-do-import'

const linha = (hash: string, amount: number, kind: LinhaEnviada['kind'] = 'COMPRA_AVISTA'): LinhaEnviada =>
  ({ kind, amount, contentHash: hash })

/** as 40 linhas da fatura: 32 novas (2.365,85) + 8 que já moram em faturas ANTIGAS (828,50) */
const NOVAS = Array.from({ length: 32 }, (_, i) => linha(`novo-${i}`, 2365.85 / 32))
const JA_NO_SISTEMA = Array.from({ length: 8 }, (_, i) => linha(`velho-${i}`, 828.5 / 8))
const AS_40 = [...NOVAS, ...JA_NO_SISTEMA]
/** ⭐ o que a dedup por HASH aponta — as 8 estão gravadas, em OUTRAS competências */
const HASHES_GRAVADOS = new Set(JA_NO_SISTEMA.map((l) => l.contentHash))

describe('⭐⭐ o caso REAL: 32 novas + 8 que moram em faturas antigas', () => {
  it('⭐⭐ fecha em 3.194,35 com a partição por hash', () => {
    const f = fecharImport(AS_40, HASHES_GRAVADOS)
    expect(f.novas).toBe(2365.85)
    expect(f.jaNoSistema, 'as 8 vivem em jun/jul/ago — a competência não as acha').toBe(828.5)
    expect(f.net).toBe(3194.35)
    expect(f.enviadasDuplicadas).toBe(8)
  })

  /**
   * ⛔⛔ O CONTRAFACTUAL DO DEFEITO QUE EU CRIEI: buscar por competência devolve conjunto
   * VAZIO pra estas 8 (elas estão em 2026-06/07/08, não em 2026-09) — e o fechamento volta
   * a dar exatamente a mensagem que o dono recebeu.
   */
  it('⛔ partição vazia (a busca por competência) reproduz o erro: 2.365,85 × 3.194,35', () => {
    const f = fecharImport(AS_40, new Set())
    expect(f.jaNoSistema).toBe(0)
    expect(f.novas).toBe(3194.35) // ⚠️ e aí ele trata as 8 como NOVAS — o outro lado do mesmo erro
    const soAsMarcadas = fecharImport(NOVAS, new Set())
    expect(soAsMarcadas.net).toBe(2365.85)
    expect(Math.round((3194.35 - soAsMarcadas.net) * 100) / 100).toBe(828.5)
  })
})

describe('⛔ a defesa não afrouxa', () => {
  it('⭐ fatura 100% nova: nada gravado, fechamento cheio', () => {
    const f = fecharImport(NOVAS, new Set())
    expect(f.jaNoSistema).toBe(0)
    expect(f.net).toBe(2365.85)
  })

  it('⛔ linha faltando continua não fechando', () => {
    const f = fecharImport(NOVAS.slice(0, 31), new Set())
    expect(f.net).toBeLessThan(2365.85)
  })

  /** ⭐ reenvio integral: tudo já existe → fecha igual e NADA regrava */
  it('⭐ reenvio da fatura inteira fecha sem dupla contagem', () => {
    const f = fecharImport(AS_40, new Set(AS_40.map((l) => l.contentHash)))
    expect(f.novas).toBe(0)
    expect(f.jaNoSistema).toBe(3194.35)
    expect(f.net, 'a mesma linha contada dos dois lados dobraria o total').toBe(3194.35)
    expect(f.enviadasDuplicadas).toBe(40)
  })
})

describe('⭐ os sinais na partição', () => {
  it('⭐ estorno já no sistema SUBTRAI do lado dele', () => {
    const c = linha('c1', 18, 'ESTORNO')
    const f = fecharImport([linha('n1', 100), c], new Set(['c1']))
    expect(f.novas).toBe(100)
    expect(f.jaNoSistema).toBe(-18)
    expect(f.net).toBe(82)
  })

  it('⭐ e estorno NOVO subtrai do lado das novas', () => {
    const f = fecharImport([linha('n1', 100), linha('n2', 18, 'ESTORNO')], new Set())
    expect(f.novas).toBe(82)
    expect(f.net).toBe(82)
  })
})

describe('⛔ a TELA manda as já-no-sistema junto — senão o servidor nunca as vê', () => {
  const tela = () =>
    readFileSync(join(process.cwd(), 'app/(dashboard)/empresas/[id]/cartoes/[cardId]/importar-fatura/page.tsx'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  /**
   * ⚠️ O servidor particiona pelo hash — mas só do que CHEGA. Mandando apenas as marcadas,
   * as já-no-sistema não existem pra ele, e o fechamento volta a cobrar as novas sozinhas.
   */
  it('⭐ o payload leva as marcadas MAIS as já-no-sistema', () => {
    const t = tela()
    expect(t).toMatch(/const jaNoSistema = editableLines\.filter\(\(l\) => l\.isDuplicate/)
    expect(t).toMatch(/const paraEnviar = \[\.\.\.valid, \.\.\.jaNoSistema\]/)
    expect(t).toMatch(/lines: paraEnviar\.map/)
    expect(
      /lines: valid\.map/.test(t),
      'voltou a mandar só as marcadas — o misto para de fechar',
    ).toBe(false)
  })
})
