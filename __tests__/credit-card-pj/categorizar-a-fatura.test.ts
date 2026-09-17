// ⛔⛔⛔ "CATEGORIA NÃO ENCONTRADA OU INATIVA" — DUAS FONTES E UMA PORTA FECHADA (17/09/2026)
//
// **O erro do dono:** escolher categoria na linha da fatura devolvia
// *"Não consegui categorizar · Categoria não encontrada ou inativa."*
//
// ⛔ **DOIS BLOQUEIOS EM SÉRIE, os dois medidos em prod:**
//
//  1. **O seletor lia uma fonte e a rota validava outra.** A tela pedia `/categorias` cru e
//     só tirava a fila `A_CLASSIFICAR`: **260 opções, 203 INATIVAS (78%) e 47 de RECEITA**.
//     A gravação exige `isActive`. *Quase 4 de cada 5 opções eram armadilha.*
//
//  2. **A porta não alcançava cartão.** `/despesas/recategorizar` filtrava posse por
//     `bankAccount: { companyId }`, e **compra de cartão nasce sem conta bancária**
//     (`bankAccountId` null; quem a prende à empresa é o `businessCreditCardId`). Medido:
//     `bankAccount.companyId` → 0 linhas; `businessCreditCard.companyId` → 1.
//
// ⚠️⚠️ **O nº 2 é erro meu da volta anterior:** reusei esta porta em nome da REGRA 4 **sem
// medir se ela abria pro caso novo**. A regra tem duas metades — achar a porta única *e*
// provar que ela serve. Metade dela é um bug com cara de disciplina.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { whereCategoriaAceita } from '@/lib/categorias/destino-valido'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('⭐⭐ o que a tela oferece é o que a gravação aceita', () => {
  /** ⭐ a régua da gravação: categoria ATIVA da empresa — o piso de qualquer lista */
  it('⭐ a régua mínima da gravação exige categoria ativa da empresa', () => {
    expect(whereCategoriaAceita('emp-1')).toEqual({ companyId: 'emp-1', isActive: true })
  })

  /**
   * ⛔⛔ A INVARIANTE: a lista oferecida é SUBCONJUNTO do que a rota aceita. Ela é mais
   * estrita de propósito (tira receita e a fila `A_CLASSIFICAR`), **nunca mais larga** —
   * oferecer o que a gravação recusa é a tela mentindo sobre o que dá pra fazer.
   */
  it('⭐ a lista da tela é mais estrita que a régua da rota, nunca mais larga', () => {
    const lib = fonte('lib/categorias/destino-valido.ts')
    expect(lib, 'a lista deixou de partir da régua da gravação').toMatch(/whereCategoriaAceita\(companyId\)/)
    expect(lib, 'voltou a oferecer categoria de receita').toMatch(/type: 'EXPENSE'/)
    expect(lib, 'a fila A_CLASSIFICAR voltou a ser destino').toMatch(/NOT: \{ dreGroup: 'A_CLASSIFICAR' \}/)
  })

  it('⭐ a rota de gravação valida pela MESMA régua', () => {
    expect(fonte('app/api/empresas/[id]/despesas/recategorizar/route.ts'))
      .toMatch(/whereCategoriaAceita\(companyId\)/)
  })

  /** ⛔ e a tela não pode voltar a montar a lista por conta própria */
  it('⭐ a tela do cartão recebe a lista pronta do servidor', () => {
    expect(fonte('lib/credit-card-pj/queries.ts'))
      .toMatch(/categoriasDestinoDespesa\(/)
    expect(fonte('app/(dashboard)/empresas/[id]/cartoes/[cardId]/page.tsx'))
      .toMatch(/data\?\.expenseCategories/)
  })
})

describe('⛔⛔ a porta alcança linha de CARTÃO', () => {
  /**
   * ⛔ Compra de cartão tem `bankAccountId` NULL. Filtrar posse só por `bankAccount`
   * deixava a fatura inteira fora do alcance — *"Nenhuma transação encontrada na empresa"*
   * mesmo com categoria válida.
   */
  it('⭐ o filtro de posse aceita bankAccount OU businessCreditCard', () => {
    const r = fonte('app/api/empresas/[id]/despesas/recategorizar/route.ts')
    expect(r, 'voltou a exigir conta bancária — a fatura fica inalcançável')
      .toMatch(/OR: \[[\s\S]{0,200}businessCreditCard: \{ companyId \}/)
  })
})

describe('⭐ a recusa que sobra ENSINA a saída', () => {
  /**
   * ⭐ A régua do tradutor 422 do estoque: *"recusa ensina a saída"*. A mensagem antiga
   * (*"Categoria não encontrada ou inativa"*) mandava o dono adivinhar QUAL das opções era
   * o problema.
   */
  it('⭐ diz o NOME da categoria, o PORQUÊ e para onde ir', () => {
    const r = fonte('app/api/empresas/[id]/despesas/recategorizar/route.ts')
    expect(r).toMatch(/est. INATIVA/)
    expect(r).toMatch(/de outra empresa/)
    expect(r).toMatch(/saida: \{ rotulo/)
    expect(r, 'a mensagem genérica voltou').not.toMatch(/'Categoria não encontrada ou inativa\.'/)
  })
})

describe('⭐ o feedback de salvo — silêncio depois do clique não vale', () => {
  const tela = () => fonte('app/(dashboard)/empresas/[id]/cartoes/[cardId]/page.tsx')

  it('⭐ o selo "salvo ✓" existe e depende do que GRAVOU', () => {
    expect(tela()).toMatch(/salvos\.has\(t\.id\)[\s\S]{0,120}salvo ✓/)
  })

  /**
   * ⚠️ o `value` do select vem de `data`, que só muda no reload — sem o otimista ele VOLTA
   * pra "sem categoria" na frente do dono, que é o fracasso-disfarçado de novo.
   *
   * ⭐ REAPONTADO em 17/09, não afrouxado: a regra **mudou de casa** pra `valorDoSeletor`
   * (função pura, testável — *regra que mora num `value={...}` é regra que ninguém prova*).
   * A pergunta continua a mesma; o que mudou é onde ela é respondida, e lá ela tem teste
   * próprio com o otimista vencendo o gravado.
   */
  it('⭐ o seletor segue o dedo na hora (otimista) — agora pela regra com dono', () => {
    expect(tela()).toMatch(/value=\{valorDoSeletor\(otimista, t\)\}/)
  })

  it('⛔ e a FALHA reverte o otimista em vez de deixar a escolha na tela', () => {
    const t = tela()
    expect(t, 'a falha deixou de reverter — a tela diria que gravou')
      .toMatch(/if \(!resp\.ok\)[\s\S]{0,400}setOtimista\(\(p\) => \{[\s\S]{0,200}delete n\[id\]/)
  })
})
