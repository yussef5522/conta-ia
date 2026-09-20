// ⛔⛔⛔ O BUG DA ELIANE — PALPITE ACESO, PAINEL VAZIO (20/09/2026)
//
// **O dono:** *"a linha ELIANE R$ 200 acende o palpite («eliane · valor exato · 1 dia
// depois do vencimento») mas clicar «✓ Confirmar — concilia a eliane» abre o painel VAZIO:
// «0 ranqueados · nenhuma conta bate com ELIANE GARCIA»."*
//
// **A causa, medida em prod:** o palpite tem o candidato **POR ID** (`alvo.contaId`) e o
// botão o **descartava**, mandando abrir o painel — que re-busca **POR NOME do extrato**.
// E no cadastro **não existe nenhum fornecedor nem conta com "eliane"**: a conta foi achada
// por valor+data, não por nome.
//
// ***Duas réguas pra mesma pergunta, e a segunda jogava fora a resposta que a primeira já
// tinha.*** É a família do B1, agora entre o palpite e o painel.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { escolherPalpite, palpiteLevaAoAlvo, idsDoAlvo, type CandidatoBruto } from '@/lib/conciliacao/palpite-da-linha'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

function usosDe(src: string, simbolo: string): number {
  return src.split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

/** o caso REAL: a conta foi achada por valor+data, e o nome do extrato não bate com nada */
const ELIANE: CandidatoBruto = {
  acao: 'CASAR_PAGAR',
  familia: '🧾 CASAR COM CONTA A PAGAR',
  titulo: 'eliane',
  detalhe: 'valor exato · 1 dia depois do vencimento',
  diferenca: 0,
  confianca: 'ALTA',
  alvo: { contaId: 'conta_eliane_123' },
  alvoNome: 'eliane',
}

describe('⛔⛔ o palpite com ID EFETIVA — não reabre busca', () => {
  it('⭐ o caso da ELIANE: palpite aceso e o botão NÃO leva ao painel', () => {
    const p = escolherPalpite([ELIANE], 'SAIDA', 200)
    expect(p, 'o palpite precisa acender — é o cenário do dono').toBeTruthy()
    expect(idsDoAlvo(p!)).toEqual(['conta_eliane_123'])
    expect(palpiteLevaAoAlvo(p!), 'com id na mão, reabrir a busca é jogar a resposta fora').toBe(false)
  })

  it('⛔ e SEM id continua levando ao painel — ele é o caminho manual', () => {
    const semId = { ...ELIANE, alvo: {} }
    const p = escolherPalpite([semId], 'SAIDA', 200)
    expect(palpiteLevaAoAlvo(p!)).toBe(true)
  })

  it('⭐ lista de ids (N:1) também efetiva', () => {
    const varios = { ...ELIANE, alvo: { contaIds: ['a', 'b'] } }
    const p = escolherPalpite([varios], 'SAIDA', 200)
    expect(idsDoAlvo(p!)).toEqual(['a', 'b'])
    expect(palpiteLevaAoAlvo(p!)).toBe(false)
  })
})

describe('⛔⛔ a gravação é a PORTA ÚNICA — nenhuma segunda régua nasceu', () => {
  it('⭐ o resolver delega ao MESMO reconcileTransactions do Find & Match', () => {
    const r = fonte('lib/conciliacao/resolver-linha.ts')
    expect(usosDe(r, 'reconcileTransactions'), 'o balcão voltou a não gravar o vínculo').toBeGreaterThan(0)
    expect(r, 'N:1 sem groupId não desfaz agrupado').toMatch(/reconcileGroupId: grupo/)
  })

  it('⛔ sem alvo, a recusa continua ENSINANDO (não é passe livre)', () => {
    const r = fonte('lib/conciliacao/resolver-linha.ts')
    expect(r).toMatch(/Escolha a\(s\) conta\(s\) a pagar no painel desta linha/)
  })

  it('⭐ a rota aceita a lista de ids — senão o schema a descarta em silêncio', () => {
    expect(fonte('app/api/conciliacao/resolver/route.ts')).toMatch(/contaIds: z\.array\(z\.string\(\)\.min\(1\)\)/)
  })
})

describe('⭐ e a TELA não abre o painel quando já tem a resposta', () => {
  const t = fonte('components/conciliacao/caixa-de-entrada.tsx')

  it('⛔ o desvio pro painel passou a exigir AUSÊNCIA de alvo', () => {
    expect(t, 'voltou a abrir o painel sempre — é o bug da ELIANE de volta')
      .not.toMatch(/if \(acao === 'CASAR_PAGAR' \|\| acao === 'CASAR_RECEBER'\) \{ setProcurando\(linha\); return \}/)
    expect(t).toMatch(/&& !idsDoAlvo\.length\) \{ setProcurando\(linha\); return \}/)
  })

  it('⭐ e quando o painel abre, ele vem COM o candidato marcado', () => {
    expect(t).toMatch(/preSelecionados=\{idsDoPalpite\(l\)\}/)
    expect(fonte('components/conciliacao/find-and-match-panel.tsx'))
      .toMatch(/useState<Set<string>>\(new Set\(preSelecionados \?\? \[\]\)\)/)
  })

  it('⭐ o alvo vai pro servidor num formato só (lista), nunca em dois', () => {
    expect(t).toMatch(/contaIds: idsDoAlvo, contaId: undefined/)
  })
})
