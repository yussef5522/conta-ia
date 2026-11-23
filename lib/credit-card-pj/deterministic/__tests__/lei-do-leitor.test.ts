// ⭐⭐⭐ A LEI DO LEITOR DE FATURA (23/11/2026) — executada (REGRA 3) pela MESMA porta do runtime
// (`lerFaturaPorTexto`), contra fixtures de texto REAL (anonimizado).
//
// ⛔ O CASO: o Sicredi de novembro trouxe DOIS cartões (0115 físico + 0708 virtual) e o leitor
// recusou uma leitura correta. Aqui: (1) o Sicredi de 2 cartões fecha EXATO por cartão e na fatura;
// (2) TODO banco registrado entrega as duas provas (cartão + fatura); (3) linha engolida, total
// divergente e banco desconhecido são RECUSA — nada é importado, nunca em silêncio; (4) a parcela
// antiga cai no mês e ano certos.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { lerFaturaPorTexto, BANCOS_SUPORTADOS } from '../../extract-invoice-smart'
import { CreditCardPjExtractError } from '../../types'
import { resolveDate } from '../sicredi-fatura-parser'
import { aplicarLeiDoLeitor, BANCOS_COM_LEITOR } from '../lei-do-leitor'

const dir = join(__dirname, 'fixtures')
const ler = (f: string) => readFileSync(join(dir, f), 'utf-8')
const NOV = ler('sicredi-fatura-2-cartoes-2026-11.txt')
const recusa = (texto: string): CreditCardPjExtractError => {
  try { lerFaturaPorTexto(texto) } catch (e) { if (e instanceof CreditCardPjExtractError) return e; throw e }
  throw new Error('a fatura foi ACEITA — esperava recusa')
}

describe('Sicredi · novembro/2026 — DOIS cartões, cada um fecha com o SEU total', () => {
  // ⚠️ a leitura acontece DENTRO dos testes (lazy): um parser quebrado falha cada teste pelo nome,
  // em vez de derrubar a coleta do arquivo inteiro
  let memo: ReturnType<typeof lerFaturaPorTexto> | null = null
  const ler1 = () => (memo ??= lerFaturaPorTexto(NOV))
  const R = () => ler1()
  const LL = () => ler1().extraction.lines
  const doCartao = (f: string) => LL().filter((l) => l.cardLastDigits === f)
  const soma = (ls: ReturnType<typeof LL>) => Math.round(ls.filter((l) => l.suggestedKind !== 'ESTORNO').reduce((s, l) => s + l.amount, 0) * 100) / 100

  it('aceita, pelo leitor determinístico, com as DUAS provas', () => {
    expect(R().source).toBe('PDFTEXT')
    expect(R().validation!.ok).toBe(true)
    expect(R().validation!.checks.some((c) => c.lei === 'CARTAO')).toBe(true)
    expect(R().validation!.checks.some((c) => c.lei === 'FATURA')).toBe(true)
  })
  it('31 transações no físico (0000) = R$ 3.788,86 · 11 no virtual (1111) = R$ 1.170,23 · fatura R$ 4.810,69', () => {
    expect(doCartao('0000')).toHaveLength(31)
    expect(doCartao('1111')).toHaveLength(11)
    expect(LL()).toHaveLength(42)
    expect(soma(doCartao('0000'))).toBe(3788.86)
    expect(soma(doCartao('1111'))).toBe(1170.23)
    expect(R().extraction.totalToPay).toBe(4810.69)
    expect(R().extraction.cardLastDigitsFound.sort()).toEqual(['0000', '1111'])
  })
  it('pagamento fica FORA (não é gasto); estorno entra como ESTORNO (negativo); IOF é encargo', () => {
    expect(LL().some((l) => /pagamento/i.test(l.description))).toBe(false)
    expect(LL().filter((l) => l.suggestedKind === 'ESTORNO').map((l) => l.amount)).toEqual([148.4])
    expect(LL().filter((l) => /iof/i.test(l.description)).map((l) => [l.amount, l.suggestedKind])).toEqual([[6.35, 'ENCARGO_FINANCEIRO'], [3.87, 'ENCARGO_FINANCEIRO']])
  })
  it('compra no exterior PRESERVA o dólar e a cotação', () => {
    const ext = LL().filter((l) => l.usd != null).map((l) => [l.usd, l.cotacaoDolar, l.amount])
    expect(ext).toEqual([[36, 5.04, 181.56], [22, 5.04, 110.79]])
    expect(LL().find((l) => l.amount === 181.56)!.description).toBe('Bnanacademy Com London Gb')
  })
  it('parcela antiga mantém a DATA ORIGINAL com o ano certo (25/fev · 09/10 → 2026-02-25)', () => {
    const p = LL().find((l) => l.installmentNumber === 9 && l.installmentTotal === 10)!
    expect(p.date).toBe('2026-02-25')
    expect(LL().every((l) => l.date <= '2026-10-31')).toBe(true)
  })
})

describe('o ano da parcela antiga se infere pela PARCELA (trap 9)', () => {
  it('"15/out 13/18" numa fatura que fecha em out/2026 é de out/2025 — não do mês corrente', () => {
    expect(resolveDate('15/out', 10, 2026, { number: 13, total: 18 })).toBe('2025-10-15')
    expect(resolveDate('15/out', 10, 2026, null)).toBe('2026-10-15')
  })
  it('mês depois do fechamento é do ano anterior (trap 4 continua valendo)', () => {
    expect(resolveDate('10/dez', 10, 2026, null)).toBe('2025-12-10')
    expect(resolveDate('25/fev', 10, 2026, { number: 9, total: 10 })).toBe('2026-02-25')
  })
})

describe('⛔ meia-fatura não existe — recusa honesta, nada importado', () => {
  it('LINHA ENGOLIDA → recusa (a conta do cartão não fecha)', () => {
    const e = recusa(NOV.replace(/.*Netflix Com.*\n/, ''))
    expect(e.code).toBe('VALIDATION_FAILED')
    expect(e.message).toMatch(/cartão final 0000/)
    expect(e.message).toMatch(/nada foi importado/)
    expect(e.texto).toBeTruthy() // a quarentena recebe o texto
  })
  it('TOTAL DO CARTÃO divergente → recusa', () => {
    expect(NOV).toMatch(/Total cartão portador virtual \(final 1111\)\s+R\$ 1\.170,23/)
    const e = recusa(NOV.replace(/(Total cartão portador virtual \(final 1111\)\s+R\$ )1\.170,23/g, (_m, a: string) => `${a}1.171,23`))
    expect(e.code).toBe('VALIDATION_FAILED')
  })
  it('TOTAL DA FATURA divergente → recusa', () => {
    expect(NOV).toMatch(/^\s*Total desta Fatura\s+4\.810,69/m)
    const e = recusa(NOV.replace(/^(\s*Total desta Fatura\s+)4\.810,69/m, (_m, a: string) => `${a}4.900,69`))
    expect(e.code).toBe('VALIDATION_FAILED')
    expect(e.message).toMatch(/Total desta Fatura/)
  })
  it('BANCO DESCONHECIDO não importa vazio em silêncio: recusa dizendo quais bancos são lidos', () => {
    const e = recusa('BANCO QUALQUER S.A.\nFatura do cartão\n10/out  LOJA X   R$ 10,00\nTotal R$ 10,00\n')
    expect(e.code).toBe('BANCO_NAO_SUPORTADO')
    for (const b of BANCOS_SUPORTADOS) expect(e.message).toContain(b)
    expect(e.texto).toContain('BANCO QUALQUER')
  })
  it('LAYOUT DIFERENTE (banco reconhecido, sem totais) → recusa com o motivo', () => {
    const e = recusa('Sicredi\nVisa Empresas\nalguma coisa que não é fatura\n')
    expect(e.code).toBe('LAYOUT_DIFERENTE')
  })
})

describe('⭐ A LEI VALE PRA TODO BANCO — cada fixture registrada entrega as DUAS provas', () => {
  const FIXTURES = readdirSync(dir).filter((f) => f.endsWith('.txt'))
  it('o guard está olhando as fixtures (não passa por lista vazia)', () => expect(FIXTURES.length).toBeGreaterThanOrEqual(9))
  for (const f of FIXTURES) {
    it(f, () => {
      const r = lerFaturaPorTexto(ler(f))
      expect(r.validation!.ok).toBe(true)
      const leis = new Set(r.validation!.checks.filter((c) => c.pass).map((c) => c.lei))
      expect(leis.has('CARTAO'), `${f}: sem a prova por cartão`).toBe(true)
      expect(leis.has('FATURA'), `${f}: sem a prova da fatura`).toBe(true)
    })
  }
  it('validador que esquece de marcar uma das provas é RECUSADO pela porta (não passa por omissão)', () => {
    const v = aplicarLeiDoLeitor({ ok: true, message: null, checks: [{ name: 'x', expected: 1, got: 1, diff: 0, pass: true, lei: 'CARTAO' }] }, 'Banco Novo')
    expect(v).toMatchObject({ ok: false, motivo: 'LAYOUT_DIFERENTE' })
  })
})

describe('⛔ FALHA NUNCA É SILENCIOSA — a tela de import (lida sem comentário)', () => {
  const semComentario = (src: string) =>
    src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const TELA = semComentario(readFileSync(join(process.cwd(), 'app/(dashboard)/empresas/[id]/cartoes/[cardId]/importar-fatura/page.tsx'), 'utf-8'))
  const ROTA = semComentario(readFileSync(join(process.cwd(), 'app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/preview/route.ts'), 'utf-8'))
  it('a tela promete EXATAMENTE os bancos que o leitor lê (nada de "e outros bancos")', () => {
    expect([...BANCOS_COM_LEITOR]).toEqual([...BANCOS_SUPORTADOS])
    expect(TELA).toContain("BANCOS_COM_LEITOR.join(', ')")
    expect(TELA).not.toMatch(/outros bancos/i)
  })
  it('a recusa ABRE a tela (antes da área de upload), com o título do MOTIVO e "nada foi importado"', () => {
    const recusa = TELA.indexOf('data-testid="recusa-da-fatura"')
    expect(recusa).toBeGreaterThan(-1)
    expect(recusa).toBeLessThan(TELA.indexOf('Clique pra selecionar PDF'))
    expect(TELA).toContain('TITULO_DA_RECUSA[extractError.motivo]')
    expect(TELA).toContain('Nada foi importado.')
  })
  it('a rota manda o MOTIVO e guarda TODA recusa na quarentena (o registro)', () => {
    expect(ROTA).toMatch(/motivo: code === 'BANCO_NAO_SUPORTADO'/)
    expect(ROTA).toMatch(/void guardarNaQuarentena\(\{[\s\S]*?desfecho: 'RECUSADA'/)
  })
})
